-- Drop the category level: items now belong directly to a service. The
-- extra Service -> Category -> Item hop turned out to be more structure
-- than the admin flow needed, so this flattens it to Service -> Item.
--
-- Also replaces the user-entered barcode/unique_code pair with a single
-- item_code that the backend generates on creation (see ServiceItem /
-- CatalogController) - one generated value serves as both the printed
-- barcode's content and the searchable ID, instead of keeping two columns
-- that would always hold the same thing.

ALTER TABLE service_item ADD COLUMN service_id BIGINT;

UPDATE service_item si
SET service_id = sc.service_id
FROM service_category sc
WHERE si.category_id = sc.id;

ALTER TABLE service_item ALTER COLUMN service_id SET NOT NULL;
ALTER TABLE service_item ADD CONSTRAINT fk_service_item_service FOREIGN KEY (service_id) REFERENCES service(id);
CREATE INDEX idx_service_item_service_id ON service_item (service_id);

ALTER TABLE service_item DROP CONSTRAINT service_item_category_id_fkey;
ALTER TABLE service_item DROP COLUMN category_id;

DROP TABLE service_category;

-- item_code replaces barcode + unique_code. Nullable at the DB level only
-- because the id-based code can't be computed until after the row's first
-- insert (it's generated from the auto-increment id) - the application
-- always fills it in immediately, within the same request, before anyone
-- else can read the row.
ALTER TABLE service_item DROP COLUMN barcode;
ALTER TABLE service_item DROP COLUMN unique_code;
ALTER TABLE service_item ADD COLUMN item_code VARCHAR(50) UNIQUE;
CREATE INDEX idx_service_item_item_code ON service_item (item_code);
