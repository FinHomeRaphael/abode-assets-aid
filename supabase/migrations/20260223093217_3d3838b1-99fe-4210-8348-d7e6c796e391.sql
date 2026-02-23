
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
    -- Clean up empty households and their dependent data
    IF NOT EXISTS (SELECT 1 FROM public.household_members WHERE household_id = existing_household) THEN
      DELETE FROM public.transactions WHERE household_id = existing_household;
      DELETE FROM public.budgets WHERE household_id = existing_household;
      DELETE FROM public.savings_deposits WHERE household_id = existing_household;
      DELETE FROM public.savings_goals WHERE household_id = existing_household;
      DELETE FROM public.debts WHERE household_id = existing_household;
      DELETE FROM public.accounts WHERE household_id = existing_household;
      DELETE FROM public.categories WHERE household_id = existing_household;
      DELETE FROM public.invitations WHERE household_id = existing_household;
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
