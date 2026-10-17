package com.sanasboutique.backend.catalog.storage;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.util.UUID;

/**
 * Dev-mode placeholder: computes the GCS path an item photo WOULD live at,
 * but never actually uploads it. Wires up the shape the app will use
 * (a stable gs://bucket/service-items/{itemId}/{uuid}-{filename} path
 * stored with the item's metadata) so nothing about the item/image model
 * needs to change once real storage is turned on for testing - only this
 * class gets replaced with one that actually calls the GCS client.
 *
 * app.storage.gcs-bucket is a placeholder name; set the real bucket via
 * application.yml or an env var before going live.
 */
@Service
public class StubImageStorageService implements ImageStorageService {

    private final String bucket;

    public StubImageStorageService(
            @Value("${app.storage.gcs-bucket:sanas-boutique-catalog}") String bucket) {
        this.bucket = bucket;
    }

    @Override
    public String store(MultipartFile file, Long itemId) {
        String originalName =
                file.getOriginalFilename() == null ? "photo" : file.getOriginalFilename();
        String safeName = originalName.replaceAll("[^A-Za-z0-9._-]", "_");
        return "gs://%s/service-items/%d/%s-%s"
                .formatted(bucket, itemId, UUID.randomUUID(), safeName);
    }
}
