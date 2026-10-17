package com.sanasboutique.backend.outlet.dto.request;

import java.util.List;

/** Report criteria; every field is optional (empty = no restriction). Dates are yyyy-MM-dd, inclusive. */
public record ReportRequest(List<Long> outletIds, List<Long> serviceIds, String from, String to) {}
