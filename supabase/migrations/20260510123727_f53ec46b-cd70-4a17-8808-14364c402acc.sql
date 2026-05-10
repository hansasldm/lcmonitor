CREATE OR REPLACE FUNCTION public.sync_heartbeat_timestamp()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
begin
  new.timestamp = new.last_seen;
  return new;
end;
$function$;