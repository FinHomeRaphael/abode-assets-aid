
CREATE OR REPLACE FUNCTION public.insert_default_categories()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.categories (household_id, name, emoji, type, is_default) VALUES
    (NEW.id, 'Logement', '🏠', 'expense', true),
    (NEW.id, 'Alimentation', '🛒', 'expense', true),
    (NEW.id, 'Transport', '🚗', 'expense', true),
    (NEW.id, 'Santé', '💊', 'expense', true),
    (NEW.id, 'Assurance', '🛡️', 'expense', true),
    (NEW.id, 'Abonnements', '📱', 'expense', true),
    (NEW.id, 'Loisirs', '🎬', 'expense', true),
    (NEW.id, 'Restaurants', '🍽️', 'expense', true),
    (NEW.id, 'Shopping', '🛍️', 'expense', true),
    (NEW.id, 'Éducation', '📚', 'expense', true),
    (NEW.id, 'Voyages', '✈️', 'expense', true),
    (NEW.id, 'Cadeaux', '🎁', 'expense', true),
    (NEW.id, 'Épargne', '💰', 'expense', true),
    (NEW.id, 'Impôts', '🏛️', 'expense', true),
    (NEW.id, 'Autre', '📌', 'expense', true),
    (NEW.id, 'Salaire', '💵', 'income', true),
    (NEW.id, 'Freelance', '💻', 'income', true),
    (NEW.id, 'Investissements', '📈', 'income', true),
    (NEW.id, 'Aides & Allocations', '🤝', 'income', true),
    (NEW.id, 'Autre', '📌', 'income', true);
  RETURN NEW;
END;
$function$;
