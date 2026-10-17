package com.sanasboutique.backend.outlet.mapper;

import com.sanasboutique.backend.outlet.dto.response.*;
import com.sanasboutique.backend.outlet.entity.Outlet;

import org.springframework.stereotype.Component;

@Component
public class OutletMapper {
    public OutletResponse toResponse(Outlet o) {
        return new OutletResponse(
                o.getId(),
                o.getName(),
                o.getOwnerName(),
                o.getAddress(),
                o.getMobileNumber(),
                o.getEmail(),
                o.isActive());
    }

    public OutletCreatedResponse toCreated(Outlet o, String password) {
        return new OutletCreatedResponse(
                o.getId(),
                o.getName(),
                o.getOwnerName(),
                o.getAddress(),
                o.getMobileNumber(),
                o.getEmail(),
                o.isActive(),
                password);
    }
}
