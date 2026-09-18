package com.arena3.controller;

import com.arena3.entity.CourtEntity;
import com.arena3.entity.UserEntity;
import com.arena3.security.SecurityUtils;
import com.arena3.service.CourtBookingService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/v1")
public class CourtBookingController {

    private final CourtBookingService courtBookingService;

    public CourtBookingController(CourtBookingService courtBookingService) {
        this.courtBookingService = courtBookingService;
    }

    @GetMapping("/courts")
    public ResponseEntity<?> getCourts() {
        List<CourtEntity> courts = courtBookingService.getCourts();
        return ResponseEntity.ok(Map.of("items", courts));
    }

    @GetMapping("/occupancy")
    public ResponseEntity<?> getOccupancy(@RequestParam(value = "date", required = false) String date) {
        return ResponseEntity.ok(courtBookingService.getOccupancy(date));
    }

    @PostMapping("/bookings")
    public ResponseEntity<?> holdBooking(@RequestBody Map<String, Object> body) {
        UserEntity user = SecurityUtils.getCurrentUser();
        Map<String, Object> res = courtBookingService.holdBooking(body, user);
        return ResponseEntity.status(HttpStatus.CREATED).body(res);
    }

    @PostMapping("/bookings/{id}/confirm")
    public ResponseEntity<?> confirmBooking(@PathVariable("id") UUID id, @RequestBody(required = false) Map<String, Object> body) {
        UserEntity user = SecurityUtils.requireCurrentUser();
        String method = body != null && body.containsKey("method") ? String.valueOf(body.get("method")) : "transfer";
        Map<String, Object> res = courtBookingService.confirmBooking(id, method, user);
        return ResponseEntity.ok(res);
    }

    @PostMapping("/bookings/{id}/cancel")
    public ResponseEntity<?> cancelBooking(@PathVariable("id") UUID id) {
        UserEntity user = SecurityUtils.getCurrentUser();
        Map<String, Object> res = courtBookingService.cancelBooking(id, user);
        return ResponseEntity.ok(res);
    }

    @PostMapping("/bookings/{id}/check-in")
    public ResponseEntity<?> checkInBooking(@PathVariable("id") UUID id) {
        UserEntity user = SecurityUtils.requireCurrentUser();
        Map<String, Object> res = courtBookingService.checkInBooking(id, user);
        return ResponseEntity.ok(res);
    }

    @GetMapping("/bookings/{id}")
    public ResponseEntity<?> getBooking(@PathVariable("id") UUID id) {
        UserEntity user = SecurityUtils.requireCurrentUser();
        return ResponseEntity.ok(courtBookingService.getBooking(id, user));
    }

    @PostMapping("/walk-in")
    public ResponseEntity<?> walkIn(@RequestBody Map<String, Object> body) {
        UserEntity user = SecurityUtils.requireCurrentUser();
        Map<String, Object> res = courtBookingService.walkIn(body, user);
        return ResponseEntity.status(HttpStatus.CREATED).body(res);
    }

    @PostMapping("/convert")
    public ResponseEntity<?> convertSlot(@RequestBody Map<String, Object> body) {
        UserEntity user = SecurityUtils.requireCurrentUser();
        return ResponseEntity.status(HttpStatus.CREATED).body(courtBookingService.convertSlot(body, user));
    }

    @PostMapping("/convert/{id}/release")
    public ResponseEntity<?> convertRelease(@PathVariable("id") UUID id) {
        UserEntity user = SecurityUtils.requireCurrentUser();
        return ResponseEntity.ok(courtBookingService.convertRelease(id, user));
    }
}
