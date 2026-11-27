begin;
alter table public.profiles add column onboarding_completed_at timestamptz;

create or replace function public.allit_save_profile(name text, title text, selected_character text, speak boolean) returns void
language plpgsql set search_path = '' as $$
begin
  insert into public.profiles as profile (user_id,display_name,preferred_title,selected_character_id,onboarding_completed_at)
  values (auth.uid(), name, title, selected_character, now()) on conflict (user_id) do update set
    display_name=excluded.display_name, preferred_title=excluded.preferred_title, selected_character_id=excluded.selected_character_id,
    onboarding_completed_at=coalesce(profile.onboarding_completed_at,excluded.onboarding_completed_at);
  insert into public.user_settings(user_id,speak_replies) values (auth.uid(),speak)
  on conflict (user_id) do update set speak_replies=excluded.speak_replies;
end $$;
commit;
