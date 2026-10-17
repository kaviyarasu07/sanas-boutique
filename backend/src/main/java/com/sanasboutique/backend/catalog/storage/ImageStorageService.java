package com.sanasboutique.backend.catalog.storage;

import org.springframework.web.multipart.MultipartFile;

/**
 * Where an uploaded item photo ends up. One method, one job: take the
 * uploaded file and the item it belongs to, return the path/URL it's
 * stored at. CatalogController only depends on this interface, so swapping
 * the dev-mode stub (StubImageStorageService) for a real GCS-backed
 * implementation later is a one-class change, not a redesign.
 */
public interface ImageStorageService {

    String store(MultipartFile file, Long itemId);
}
