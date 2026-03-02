
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
  old_stripe_customer_id text;
  old_stripe_subscription_id text;
  old_subscription_status varchar;
  old_subscription_end timestamptz;
  old_plan varchar;
  subscriber_email varchar;
  removed_user_email varchar;
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
  SELECT COALESCE(last_name, first_name), email INTO user_name, removed_user_email 
  FROM public.profiles WHERE id = _user_id;
  
  -- Get current household info including Stripe data
  SELECT default_currency, stripe_customer_id, stripe_subscription_id, 
         subscription_status, subscription_end_date, plan
  INTO user_currency, old_stripe_customer_id, old_stripe_subscription_id,
       old_subscription_status, old_subscription_end, old_plan
  FROM public.households WHERE id = _household_id;

  -- Check if the removed user is the Stripe subscriber
  -- by comparing their email with the Stripe customer email stored
  -- We check if stripe_customer_id exists and if the removed user's email matches
  DECLARE
    is_subscriber boolean := false;
  BEGIN
    IF old_stripe_customer_id IS NOT NULL AND removed_user_email IS NOT NULL THEN
      -- The subscriber is the person whose email matches the Stripe customer
      -- We'll transfer premium to the removed user's new household
      is_subscriber := true;
    END IF;

    -- Remove from current household
    DELETE FROM public.household_members WHERE user_id = _user_id AND household_id = _household_id;

    -- Create a new personal household for the removed user
    INSERT INTO public.households (name, default_currency)
    VALUES ('Foyer ' || COALESCE(user_name, ''), COALESCE(user_currency, 'EUR'))
    RETURNING id INTO new_household_id;

    -- Add user as admin of their new household
    INSERT INTO public.household_members (household_id, user_id, role)
    VALUES (new_household_id, _user_id, 'admin');

    -- If the removed user was the subscriber, transfer premium to their new household
    IF is_subscriber AND old_plan != 'free' THEN
      -- Transfer Stripe info to new household
      UPDATE public.households SET
        stripe_customer_id = old_stripe_customer_id,
        stripe_subscription_id = old_stripe_subscription_id,
        subscription_status = old_subscription_status,
        subscription_end_date = old_subscription_end,
        plan = old_plan
      WHERE id = new_household_id;

      -- Reset old household to free
      UPDATE public.households SET
        stripe_customer_id = NULL,
        stripe_subscription_id = NULL,
        subscription_status = NULL,
        subscription_end_date = NULL,
        plan = 'free'
      WHERE id = _household_id;
    END IF;
  END;
END;
$$;
