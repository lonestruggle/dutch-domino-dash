CREATE OR REPLACE FUNCTION public._wega_build_claim_sequence(_hands jsonb)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO ''
AS $$
DECLARE
  _i int;
  _j int;
  _ph jsonb;
  _t jsonb;
  _v1 int;
  _v2 int;
  _doubles jsonb := '[]'::jsonb;
  _singles jsonb := '[]'::jsonb;
  _result jsonb := '[]'::jsonb;
BEGIN
  FOR _i IN 0..jsonb_array_length(_hands)-1 LOOP
    _ph := _hands->_i;
    IF _ph IS NULL THEN CONTINUE; END IF;
    FOR _j IN 0..jsonb_array_length(_ph)-1 LOOP
      _t := _ph->_j;
      _v1 := (_t->>'value1')::int;
      _v2 := (_t->>'value2')::int;
      IF _v1 = _v2 THEN
        -- Wega di sen: alleen dubbels 1-1 t/m 5-5 (geen 6-6 of 0-0)
        IF _v1 BETWEEN 1 AND 5 THEN
          _doubles := _doubles || jsonb_build_array(jsonb_build_object('value1',_v1,'value2',_v2));
        END IF;
      ELSE
        -- Niet-dubbels: alle combinaties toegestaan
        _singles := _singles || jsonb_build_array(jsonb_build_object('value1', GREATEST(_v1,_v2), 'value2', LEAST(_v1,_v2)));
      END IF;
    END LOOP;
  END LOOP;

  SELECT COALESCE(jsonb_agg(t ORDER BY (t->>'value1')::int DESC), '[]'::jsonb)
    INTO _doubles
    FROM jsonb_array_elements(_doubles) t;
  SELECT COALESCE(jsonb_agg(t ORDER BY ((t->>'value1')::int + (t->>'value2')::int) DESC, (t->>'value1')::int DESC, (t->>'value2')::int DESC), '[]'::jsonb)
    INTO _singles
    FROM jsonb_array_elements(_singles) t;

  _result := _doubles || _singles;
  RETURN _result;
END;
$$;