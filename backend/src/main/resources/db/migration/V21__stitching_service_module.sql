-- Owner decision (2026-10-11): the outlet menu shows one module per kind of service, and only the
-- modules of services the franchisor gave the outlet. Stitching becomes a service module too, so it
-- can be given to (or withheld from) an outlet like the others.
ALTER TABLE service DROP CONSTRAINT chk_service_module;
ALTER TABLE service ADD CONSTRAINT chk_service_module
    CHECK (module IN ('RENTAL', 'PARLOUR', 'STITCHING', 'SALES'));
UPDATE service SET module = 'STITCHING' WHERE lower(name) LIKE '%stitch%' OR lower(name) LIKE '%tailor%';
