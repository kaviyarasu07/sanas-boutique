package com.sanasboutique.backend.catalog.service;

import com.sanasboutique.backend.catalog.dto.request.PriceUnitRequest;
import com.sanasboutique.backend.catalog.dto.response.PriceUnitResponse;
import com.sanasboutique.backend.catalog.entity.PriceUnit;
import com.sanasboutique.backend.catalog.exception.DuplicateResourceException;
import com.sanasboutique.backend.catalog.mapper.PriceUnitMapper;
import com.sanasboutique.backend.catalog.repository.PriceUnitRepository;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@Transactional
public class PriceUnitService {
    private final PriceUnitRepository repository;
    private final PriceUnitMapper mapper;

    public PriceUnitService(PriceUnitRepository repository, PriceUnitMapper mapper) {
        this.repository = repository;
        this.mapper = mapper;
    }

    @Transactional(readOnly = true)
    public List<PriceUnitResponse> list() {
        return repository.findAll().stream().map(mapper::toResponse).toList();
    }

    public PriceUnitResponse create(PriceUnitRequest request) {
        String name = request.name().trim();
        if (repository.existsByNameIgnoreCase(name)) {
            throw new DuplicateResourceException("That price unit already exists");
        }
        return mapper.toResponse(repository.save(new PriceUnit(name)));
    }
}
