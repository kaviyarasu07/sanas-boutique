package com.sanasboutique.backend.outlet.service;

import com.sanasboutique.backend.outlet.dto.request.OutletRequest;
import com.sanasboutique.backend.outlet.dto.response.*;

import java.util.List;

public interface OutletService {
    OutletCreatedResponse create(OutletRequest request);

    List<OutletResponse> list();

    OutletResponse get(Long id);

    OutletResponse update(Long id, OutletRequest request);

    OutletResponse setActive(Long id, boolean active);

    OutletCreatedResponse regeneratePassword(Long id);
}
