
-- Add token column to invitations table
ALTER TABLE public.invitations ADD COLUMN IF NOT EXISTS token TEXT UNIQUE;

-- Create index on token for fast lookups
CREATE INDEX IF NOT EXISTS idx_invitations_token ON public.invitations(token);

-- Allow admins to delete invitations (cancel)
CREATE POLICY "Admins can delete invitations"
ON public.invitations
FOR DELETE
USING (
  (get_household_role(auth.uid(), household_id))::text = 'admin'::text
);

-- Update handle_new_profile to conditionally skip household creation
CREATE OR REPLACE FUNCTION public.handle_new_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  new_household_id uuid;
  household_name text;
  household_currency text;
  should_skip boolean;
BEGIN
  -- Check if user was invited (skip household creation)
  SELECT COALESCE((raw_user_meta_data->>'skip_household_creation')::boolean, false)
  INTO should_skip
  FROM auth.users WHERE id = NEW.id;

  IF should_skip THEN
    RETURN NEW;
  END IF;

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
$function$;

-- Function to validate an invitation token
CREATE OR REPLACE FUNCTION public.validate_invitation_token(_token text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  inv record;
  inviter record;
  house record;
  member_count int;
BEGIN
  SELECT * INTO inv FROM public.invitations
  WHERE token = _token AND status = 'pending' AND expires_at > now();
  
  IF inv IS NULL THEN
    RETURN json_build_object('valid', false);
  END IF;

  SELECT first_name, last_name INTO inviter FROM public.profiles WHERE id = inv.invited_by;
  SELECT name, default_currency INTO house FROM public.households WHERE id = inv.household_id;
  SELECT count(*) INTO member_count FROM public.household_members WHERE household_id = inv.household_id;

  RETURN json_build_object(
    'valid', true,
    'email', inv.email,
    'household_id', inv.household_id,
    'household_name', house.name,
    'household_currency', house.default_currency,
    'member_count', member_count,
    'inviter_name', COALESCE(inviter.first_name || ' ' || COALESCE(inviter.last_name, ''), 'Quelqu''un'),
    'invitation_id', inv.id
  );
END;
$function$;

-- Grant execute to anon for token validation (pre-signup)
GRANT EXECUTE ON FUNCTION public.validate_invitation_token(text) TO anon;
GRANT EXECUTE ON FUNCTION public.validate_invitation_token(text) TO authenticated;

-- Function to accept invitation
CREATE OR REPLACE FUNCTION public.accept_invitation(_invitation_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  inv record;
  existing_household uuid;
BEGIN
  SELECT * INTO inv FROM public.invitations WHERE id = _invitation_id AND status = 'pending';
  IF inv IS NULL THEN
    RAISE EXCEPTION 'Invitation introuvable ou déjà traitée';
  END IF;

  -- Remove user from current household if any
  SELECT household_id INTO existing_household FROM public.household_members WHERE user_id = auth.uid();
  IF existing_household IS NOT NULL THEN
    DELETE FROM public.household_members WHERE user_id = auth.uid();
    -- Clean up empty households
    IF NOT EXISTS (SELECT 1 FROM public.household_members WHERE household_id = existing_household) THEN
      DELETE FROM public.households WHERE id = existing_household;
    END IF;
  END IF;

  -- Add to invited household
  INSERT INTO public.household_members (household_id, user_id, role)
  VALUES (inv.household_id, auth.uid(), COALESCE(inv.role, 'member'));

  -- Update invitation status
  UPDATE public.invitations SET status = 'accepted' WHERE id = _invitation_id;
END;
$function$;

-- Function to decline invitation
CREATE OR REPLACE FUNCTION public.decline_invitation(_invitation_id uuid, _currency text DEFAULT 'EUR')
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  inv record;
  existing_household uuid;
  new_household_id uuid;
  user_name text;
BEGIN
  SELECT * INTO inv FROM public.invitations WHERE id = _invitation_id AND status = 'pending';
  IF inv IS NULL THEN
    RAISE EXCEPTION 'Invitation introuvable ou déjà traitée';
  END IF;

  -- Check if user already has a household
  SELECT household_id INTO existing_household FROM public.household_members WHERE user_id = auth.uid();
  
  IF existing_household IS NULL THEN
    -- Create new household for the user
    SELECT COALESCE(last_name, first_name) INTO user_name FROM public.profiles WHERE id = auth.uid();
    
    INSERT INTO public.households (name, default_currency)
    VALUES ('Foyer ' || COALESCE(user_name, ''), _currency)
    RETURNING id INTO new_household_id;

    INSERT INTO public.household_members (household_id, user_id, role)
    VALUES (new_household_id, auth.uid(), 'admin');
  END IF;

  UPDATE public.invitations SET status = 'declined' WHERE id = _invitation_id;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.accept_invitation(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.decline_invitation(uuid, text) TO authenticated;
