-- Add foreign key from household_members.user_id to profiles.id
ALTER TABLE public.household_members
ADD CONSTRAINT household_members_user_id_profiles_fkey
FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;