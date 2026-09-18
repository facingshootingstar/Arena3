package com.arena3.service;

import com.arena3.entity.ClassEntity;
import com.arena3.entity.CourtEntity;
import com.arena3.entity.EnrollmentEntity;
import com.arena3.entity.SessionEntity;
import com.arena3.entity.UserEntity;
import com.arena3.exception.ApiException;
import com.arena3.repository.ClassRepository;
import com.arena3.repository.CourtRepository;
import com.arena3.repository.EnrollmentRepository;
import com.arena3.repository.SessionRepository;
import com.arena3.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;

@Service
public class ClassService {

    private final ClassRepository classRepository;
    private final SessionRepository sessionRepository;
    private final EnrollmentRepository enrollmentRepository;
    private final UserRepository userRepository;
    private final CourtRepository courtRepository;

    public ClassService(ClassRepository classRepository,
                        SessionRepository sessionRepository,
                        EnrollmentRepository enrollmentRepository,
                        UserRepository userRepository,
                        CourtRepository courtRepository) {
        this.classRepository = classRepository;
        this.sessionRepository = sessionRepository;
        this.enrollmentRepository = enrollmentRepository;
        this.userRepository = userRepository;
        this.courtRepository = courtRepository;
    }

    public List<Map<String, Object>> getClasses(UserEntity currentUser) {
        List<ClassEntity> list = classRepository.findAll();
        List<Map<String, Object>> result = new ArrayList<>();
        for (ClassEntity c : list) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", c.getId().toString());
            m.put("sport", c.getSport());
            m.put("level", c.getLevel());
            m.put("coach_id", c.getCoachId().toString());
            userRepository.findById(c.getCoachId()).ifPresent(u -> m.put("coach_name", u.getFullName()));
            m.put("court_id", c.getCourtId().toString());
            courtRepository.findById(c.getCourtId()).ifPresent(crt -> m.put("court_code", crt.getCourtCode()));
            m.put("capacity", c.getCapacity());
            m.put("enrolled_count", c.getEnrolledCount());
            m.put("rrule", c.getRrule());
            m.put("duration_min", c.getDurationMin());
            m.put("start_on", c.getStartOn().toString());
            m.put("end_on", c.getEndOn().toString());
            m.put("status", c.getStatus());

            boolean myEnrolled = false;
            if (currentUser != null) {
                myEnrolled = enrollmentRepository.findByClassIdAndUserId(c.getId(), currentUser.getId()).isPresent();
            }
            m.put("my_enrolled", myEnrolled);
            result.add(m);
        }
        return result;
    }

    public List<Map<String, Object>> getCoachSchedule(UserEntity coach) {
        List<ClassEntity> classes = classRepository.findByCoachId(coach.getId());
        List<Map<String, Object>> schedule = new ArrayList<>();
        for (ClassEntity c : classes) {
            List<SessionEntity> sessions = sessionRepository.findByClassId(c.getId());
            for (SessionEntity s : sessions) {
                Map<String, Object> item = new LinkedHashMap<>();
                item.put("id", s.getId().toString());
                item.put("class_id", c.getId().toString());
                item.put("sport", c.getSport());
                item.put("level", c.getLevel());
                courtRepository.findById(s.getCourtId()).ifPresent(crt -> item.put("court_code", crt.getCourtCode()));
                item.put("start_at", s.getStartAt().toString());
                item.put("end_at", s.getEndAt().toString());
                item.put("status", s.getStatus());
                item.put("enrolled_count", c.getEnrolledCount());
                item.put("capacity", c.getCapacity());
                schedule.add(item);
            }
        }
        return schedule;
    }

    @Transactional
    public Map<String, Object> enroll(UUID classId, UserEntity user) {
        ClassEntity c = classRepository.findById(classId)
                .orElseThrow(() -> ApiException.notFound("Không tìm thấy lớp học."));

        if (c.getEnrolledCount() >= c.getCapacity()) {
            throw ApiException.conflict("Lớp đã đầy sĩ số.");
        }

        EnrollmentEntity e = new EnrollmentEntity();
        e.setClassId(classId);
        e.setUserId(user.getId());
        e.setStatus("confirmed");
        enrollmentRepository.save(e);

        c.setEnrolledCount(c.getEnrolledCount() + 1);
        classRepository.save(c);

        Map<String, Object> res = new LinkedHashMap<>();
        res.put("success", true);
        res.put("enrollment_id", e.getId().toString());
        return res;
    }

    @Transactional
    public ClassEntity createClass(Map<String, Object> body, UserEntity user) {
        ClassEntity c = new ClassEntity();
        c.setSport((String) body.get("sport"));
        c.setLevel((String) body.get("level"));
        if (body.get("coach_id") != null) c.setCoachId(UUID.fromString((String) body.get("coach_id")));
        if (body.get("court_id") != null) c.setCourtId(UUID.fromString((String) body.get("court_id")));
        if (body.get("capacity") != null) c.setCapacity(((Number) body.get("capacity")).intValue());
        c.setRrule((String) body.get("rrule"));
        if (body.get("duration_min") != null) c.setDurationMin(((Number) body.get("duration_min")).intValue());
        if (body.get("start_on") != null) c.setStartOn(java.time.LocalDate.parse((String) body.get("start_on")));
        if (body.get("end_on") != null) c.setEndOn(java.time.LocalDate.parse((String) body.get("end_on")));
        c.setStatus("draft");
        return classRepository.save(c);
    }

    @Transactional
    public Map<String, Object> publishClass(UUID classId, UserEntity user) {
        ClassEntity c = classRepository.findById(classId)
                .orElseThrow(() -> ApiException.notFound("Không tìm thấy lớp học."));
        c.setStatus("open");
        classRepository.save(c);

        Map<String, Object> res = new LinkedHashMap<>();
        res.put("sessions", Collections.emptyList());
        res.put("skipped", Collections.emptyList());
        return res;
    }

    public List<Map<String, Object>> getClassRoster(UUID classId, UserEntity user) {
        List<EnrollmentEntity> enrollments = enrollmentRepository.findByClassId(classId);
        List<Map<String, Object>> roster = new ArrayList<>();
        for (EnrollmentEntity e : enrollments) {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("id", e.getId().toString());
            item.put("user_id", e.getUserId().toString());
            item.put("status", e.getStatus());
            userRepository.findById(e.getUserId()).ifPresent(u -> {
                item.put("full_name", u.getFullName());
                item.put("phone", u.getPhone());
                item.put("member_code", u.getMemberCode());
            });
            roster.add(item);
        }
        return roster;
    }

    @Transactional
    public void cancelEnrollment(UUID enrollmentId, UserEntity user) {
        EnrollmentEntity e = enrollmentRepository.findById(enrollmentId)
                .orElseThrow(() -> ApiException.notFound("Không tìm thấy đăng ký lớp."));
        classRepository.findById(e.getClassId()).ifPresent(c -> {
            if (c.getEnrolledCount() > 0) {
                c.setEnrolledCount(c.getEnrolledCount() - 1);
                classRepository.save(c);
            }
        });
        enrollmentRepository.delete(e);
    }
}
