package com.arena3.exception;

import lombok.Getter;

import java.util.HashMap;
import java.util.Map;

@Getter
public class ApiException extends RuntimeException {
    private final int status;
    private final String code;
    private final String br;
    private final Map<String, Object> extra = new HashMap<>();

    public ApiException(int status, String code, String message) {
        this(status, code, null, message);
    }

    public ApiException(int status, String code, String br, String message) {
        super(message);
        this.status = status;
        this.code = code;
        this.br = br;
    }

    public ApiException withExtra(String key, Object value) {
        this.extra.put(key, value);
        return this;
    }

    public static ApiException validation(String message) {
        return new ApiException(422, "VALIDATION_ERROR", message);
    }

    public static ApiException unauth(String message) {
        return new ApiException(401, "UNAUTHORIZED", message != null ? message : "Chưa đăng nhập.");
    }

    public static ApiException forbidden(String message) {
        return new ApiException(403, "FORBIDDEN", message != null ? message : "Không có quyền thực hiện.");
    }

    public static ApiException notFound(String message) {
        return new ApiException(404, "NOT_FOUND", message != null ? message : "Không tìm thấy dữ liệu.");
    }

    public static ApiException conflict(String message) {
        return new ApiException(409, "CONFLICT", message);
    }

    public static ApiException conflictSlot(String message) {
        return new ApiException(409, "CONFLICT_SLOT", message != null ? message : "Khung giờ đã có người đặt hoặc trùng lịch.");
    }

    public static ApiException conflictState(String message) {
        return new ApiException(409, "CONFLICT_STATE", message != null ? message : "Trạng thái không hợp lệ.");
    }

    public static ApiException holdExpired() {
        return new ApiException(409, "HOLD_EXPIRED", "Hết thời gian giữ sân.");
    }

    public static ApiException br(String brCode, String message) {
        return new ApiException(422, "BUSINESS_RULE", brCode, message);
    }
}
