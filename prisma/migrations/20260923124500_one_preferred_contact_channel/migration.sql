-- Guarantee at database level that one person
-- cannot have multiple preferred contact channels.
CREATE UNIQUE INDEX
"ContactChannel_one_preferred_per_person"
ON "ContactChannel"("personId")
WHERE "isPreferred" = true;
