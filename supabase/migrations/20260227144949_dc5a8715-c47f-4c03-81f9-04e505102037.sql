
CREATE OR REPLACE FUNCTION public.sync_debt_remaining_amount()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  next_capital numeric;
BEGIN
  -- Find the capital_before of the next upcoming scheduled payment
  SELECT capital_before INTO next_capital
  FROM public.debt_schedules
  WHERE debt_id = NEW.debt_id
    AND status = 'prevu'
  ORDER BY period_number ASC
  LIMIT 1;

  -- If found, update remaining_amount on the debt
  IF next_capital IS NOT NULL THEN
    UPDATE public.debts
    SET remaining_amount = next_capital
    WHERE id = NEW.debt_id;
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger after insert or update on debt_schedules
CREATE TRIGGER trg_sync_debt_remaining
AFTER INSERT OR UPDATE ON public.debt_schedules
FOR EACH ROW
EXECUTE FUNCTION public.sync_debt_remaining_amount();
