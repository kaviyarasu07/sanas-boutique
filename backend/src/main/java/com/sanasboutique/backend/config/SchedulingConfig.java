package com.sanasboutique.backend.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;

/** Turns on Spring's @Scheduled jobs inside the app (e.g. the 6:00 AM parlour auto-cancel). */
@Configuration
@EnableScheduling
public class SchedulingConfig {}
