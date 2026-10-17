package com.sanasboutique.backend.catalog.repository;

import com.sanasboutique.backend.catalog.entity.ServiceItemImage;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ServiceItemImageRepository extends JpaRepository<ServiceItemImage, Long> {

    List<ServiceItemImage> findByItemIdOrderBySortOrderAsc(Long itemId);

    void deleteByItemId(Long itemId);
}
