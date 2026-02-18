
-- Add last_name column to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_name character varying DEFAULT '';

-- Update handle_new_user to include last_name
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, first_name, last_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'first_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'last_name', '')
  );
  RETURN NEW;
END;
$$;

-- Create trigger on auth.users if not exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create function to auto-create household after profile creation
CREATE OR REPLACE FUNCTION public.handle_new_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  new_household_id uuid;
  household_name text;
  household_currency text;
BEGIN
  -- Build household name from last_name
  household_name := 'Foyer ' || COALESCE(NULLIF(NEW.last_name, ''), NEW.first_name);
  
  -- Get currency from user metadata  
  SELECT COALESCE(raw_user_meta_data->>'currency', 'EUR')
  INTO household_currency
  FROM auth.users WHERE id = NEW.id;

  -- Create household
  INSERT INTO public.households (name, default_currency)
  VALUES (household_name, household_currency)
  RETURNING id INTO new_household_id;

  -- Add user as admin member
  INSERT INTO public.household_members (household_id, user_id, role)
  VALUES (new_household_id, NEW.id, 'admin');

  RETURN NEW;
END;
$$;

-- Create trigger on profiles
DROP TRIGGER IF EXISTS on_profile_created ON public.profiles;
CREATE TRIGGER on_profile_created
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_profile();
