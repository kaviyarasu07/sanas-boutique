-- Fabric of a stitching order: the customer's own, or an in-house purchase (bought at the shop).
-- An in-house purchase may link the shop bill (fabric_bill_id), but does not have to (e.g. bought
-- on an earlier visit). Until now only the bill link existed, so a link means in-house.
ALTER TABLE stitch_order ADD COLUMN fabric_source VARCHAR(10) NOT NULL DEFAULT 'OWN'
    CONSTRAINT chk_stitch_order_fabric_source CHECK (fabric_source IN ('OWN', 'IN_HOUSE'));
UPDATE stitch_order SET fabric_source = 'IN_HOUSE' WHERE fabric_bill_id IS NOT NULL;
ALTER TABLE stitch_order ADD CONSTRAINT chk_stitch_order_fabric_bill
    CHECK (fabric_bill_id IS NULL OR fabric_source = 'IN_HOUSE');
