
CREATE OR REPLACE FUNCTION public.remove_member_from_household(_user_id uuid, _household_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  user_name text;
  user_currency text;
  new_household_id uuid;
BEGIN
  -- Only admins of the household can remove members
  IF (get_household_role(auth.uid(), _household_id))::text != 'admin' THEN
    RAISE EXCEPTION 'Seuls les admins peuvent retirer des membres';
  END IF;

  -- Cannot remove yourself
  IF _user_id = auth.uid() THEN
    RAISE EXCEPTION 'Vous ne pouvez pas vous retirer vous-même';
  END IF;

  -- Get user info
  SELECT COALESCE(last_name, first_name) INTO user_name 
  FROM public.profiles WHERE id = _user_id;
  
  -- Get current household currency
  SELECT default_currency INTO user_currency
  FROM public.households WHERE id = _household_id;

  -- Remove from current household
  DELETE FROM public.household_members WHERE user_id = _user_id AND household_id = _household_id;

  -- Create a new FREE household for the removed user
  INSERT INTO public.households (name, default_currency, plan)
  VALUES ('Foyer ' || COALESCE(user_name, ''), COALESCE(user_currency, 'EUR'), 'free')
  RETURNING id INTO new_household_id;

  -- Add user as admin of their new household
  INSERT INTO public.household_members (household_id, user_id, role)
  VALUES (new_household_id, _user_id, 'admin');
END;
$$;
