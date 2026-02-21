
CREATE OR REPLACE FUNCTION public.insert_default_categories()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.categories (household_id, name, emoji, type, is_default) VALUES
    (NEW.id, 'Location', '🏠', 'expense', true),
    (NEW.id, 'Commission', '💼', 'expense', true),
    (NEW.id, 'Restaurant + sorties', '🍽️', 'expense', true),
    (NEW.id, 'Assurance + RC Ménage', '🛡️', 'expense', true),
    (NEW.id, 'Internet-TV', '📡', 'expense', true),
    (NEW.id, 'Electricité', '⚡', 'expense', true),
    (NEW.id, 'Cadeaux', '🎁', 'expense', true),
    (NEW.id, 'Voyage', '✈️', 'expense', true),
    (NEW.id, 'Frais annexe Maison', '🏡', 'expense', true),
    (NEW.id, 'Amménagement', '🪑', 'expense', true),
    (NEW.id, 'Banque', '🏦', 'expense', true),
    (NEW.id, 'Epargne', '🐖', 'expense', true),
    (NEW.id, 'Invitation', '🎉', 'expense', true),
    (NEW.id, 'Noel', '🎄', 'expense', true),
    (NEW.id, 'Mariage', '💍', 'expense', true),
    (NEW.id, 'Autre', '📌', 'expense', true),
    (NEW.id, 'Salaire', '💰', 'income', true),
    (NEW.id, 'Freelance', '💻', 'income', true),
    (NEW.id, 'Investissement', '📈', 'income', true),
    (NEW.id, 'Allocation', '🏛️', 'income', true),
    (NEW.id, 'Autre', '📌', 'income', true);
  RETURN NEW;
END;
$function$;
