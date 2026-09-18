package com.arena3.controller;

import com.arena3.entity.UserEntity;
import com.arena3.security.SecurityUtils;
import com.arena3.service.ClassService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/v1")
public class ClassController {

    private final ClassService classService;

    public ClassController(ClassService classService) {
        this.classService = classService;
    }

    @GetMapping("/classes")
    public ResponseEntity<?> getClasses() {
        UserEntity user = SecurityUtils.getCurrentUser();
        List<Map<String, Object>> list = classService.getClasses(user);
        return ResponseEntity.ok(Map.of("items", list));
    }

    @GetMapping("/coach/schedule")
    public ResponseEntity<?> getCoachSchedule() {
        UserEntity user = SecurityUtils.requireCurrentUser();
        List<Map<String, Object>> schedule = classService.getCoachSchedule(user);
        return ResponseEntity.ok(Map.of("items", schedule));
    }

    @PostMapping("/classes/{id}/enroll")
    public ResponseEntity<?> enroll(@PathVariable("id") UUID id) {
        UserEntity user = SecurityUtils.requireCurrentUser();
        return ResponseEntity.ok(classService.enroll(id, user));
    }

    @PostMapping("/classes")
    public ResponseEntity<?> createClass(@RequestBody Map<String, Object> body) {
        UserEntity user = SecurityUtils.requireCurrentUser();
        return ResponseEntity.ok(classService.createClass(body, user));
    }

    @PostMapping("/classes/{id}/publish")
    public ResponseEntity<?> publishClass(@PathVariable("id") UUID id) {
        UserEntity user = SecurityUtils.requireCurrentUser();
        return ResponseEntity.ok(classService.publishClass(id, user));
    }

    @GetMapping("/classes/{id}/roster")
    public ResponseEntity<?> getClassRoster(@PathVariable("id") UUID id) {
        UserEntity user = SecurityUtils.requireCurrentUser();
        return ResponseEntity.ok(Map.of("items", classService.getClassRoster(id, user)));
    }

    @DeleteMapping("/enrollments/{id}")
    public ResponseEntity<?> cancelEnrollment(@PathVariable("id") UUID id) {
        UserEntity user = SecurityUtils.requireCurrentUser();
        classService.cancelEnrollment(id, user);
        return ResponseEntity.noContent().build();
    }
}
