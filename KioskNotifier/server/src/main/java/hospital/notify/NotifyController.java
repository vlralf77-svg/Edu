package hospital.notify;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.*;

import java.sql.Timestamp;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.List;

@RestController
@RequestMapping("/api/notify")
public class NotifyController {

    private final JdbcTemplate jdbc;

    @Autowired
    public NotifyController(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @GetMapping("/room")
    public ResponseEntity<Notice.RoomConfig> resolveRoom(
            @RequestParam(required = false) String pcId,
            @RequestParam(required = false) String hostname,
            @RequestParam(required = false) String ip) {

        Notice.RoomConfig r = null;
        if (pcId != null && !pcId.isBlank()) {
            r = queryOne("SELECT PC_ID, HOSTNAME, IP_ADDRESS, ROOM_CD, ROOM_NM, DOCTOR_NM, SOUND_YN " +
                    "FROM PC_ROOM_MAP WHERE PC_ID = ?", pcId);
        }
        if (r == null && hostname != null && !hostname.isBlank()) {
            r = queryOne("SELECT PC_ID, HOSTNAME, IP_ADDRESS, ROOM_CD, ROOM_NM, DOCTOR_NM, SOUND_YN " +
                    "FROM PC_ROOM_MAP WHERE HOSTNAME = ? AND ROWNUM = 1", hostname);
        }
        if (r == null && ip != null && !ip.isBlank()) {
            r = queryOne("SELECT PC_ID, HOSTNAME, IP_ADDRESS, ROOM_CD, ROOM_NM, DOCTOR_NM, SOUND_YN " +
                    "FROM PC_ROOM_MAP WHERE IP_ADDRESS = ? AND ROWNUM = 1", ip);
        }
        return r != null ? ResponseEntity.ok(r) : ResponseEntity.notFound().build();
    }

    @PostMapping("/room")
    public ResponseEntity<Void> saveRoom(@RequestBody Notice.RoomConfigRequest req) {
        int updated = jdbc.update(
                "UPDATE PC_ROOM_MAP SET HOSTNAME = ?, IP_ADDRESS = ?, ROOM_CD = ?, ROOM_NM = ?, " +
                        "DOCTOR_NM = ?, SOUND_YN = ?, UPDATED_AT = SYSTIMESTAMP WHERE PC_ID = ?",
                req.hostname(), req.ipAddress(), req.roomCd(), req.roomNm(),
                req.doctorNm(), safeSound(req.soundYn()), req.pcId());
        if (updated == 0) {
            jdbc.update(
                    "INSERT INTO PC_ROOM_MAP (PC_ID, HOSTNAME, IP_ADDRESS, ROOM_CD, ROOM_NM, DOCTOR_NM, SOUND_YN) " +
                            "VALUES (?, ?, ?, ?, ?, ?, ?)",
                    req.pcId(), req.hostname(), req.ipAddress(), req.roomCd(),
                    req.roomNm(), req.doctorNm(), safeSound(req.soundYn()));
        }
        return ResponseEntity.ok().build();
    }

    @GetMapping("/pending")
    public List<Notice.Payload> pending(@RequestParam("room") String roomCd,
                                        @RequestParam(name = "minutes", defaultValue = "30") int minutes) {
        return jdbc.query(
                "SELECT EVENT_ID, ROOM_CD, MSG_TYPE, PATIENT_NO, PATIENT_NM, DOCTOR_NM, MEMO, CREATED_AT " +
                        "FROM NOTIFY_QUEUE " +
                        "WHERE ROOM_CD = ? AND READ_AT IS NULL " +
                        "  AND CREATED_AT >= SYSTIMESTAMP - NUMTODSINTERVAL(?, 'MINUTE') " +
                        "ORDER BY CREATED_AT",
                (rs, i) -> new Notice.Payload(
                        rs.getString("EVENT_ID"),
                        rs.getString("ROOM_CD"),
                        rs.getString("MSG_TYPE"),
                        rs.getString("PATIENT_NO"),
                        rs.getString("PATIENT_NM"),
                        rs.getString("DOCTOR_NM"),
                        rs.getString("MEMO"),
                        toOffset(rs.getTimestamp("CREATED_AT")),
                        null),
                roomCd, minutes);
    }

    @PostMapping("/ack")
    public ResponseEntity<Void> ack(@RequestParam("eventId") String eventId) {
        jdbc.update("UPDATE NOTIFY_QUEUE SET DELIVERED_AT = SYSTIMESTAMP " +
                "WHERE EVENT_ID = ? AND DELIVERED_AT IS NULL", eventId);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/{eventId}/read")
    public ResponseEntity<Void> read(@PathVariable String eventId) {
        jdbc.update("UPDATE NOTIFY_QUEUE SET READ_AT = SYSTIMESTAMP " +
                "WHERE EVENT_ID = ? AND READ_AT IS NULL", eventId);
        return ResponseEntity.ok().build();
    }

    private Notice.RoomConfig queryOne(String sql, Object... args) {
        var list = jdbc.query(sql,
                (rs, i) -> new Notice.RoomConfig(
                        rs.getString("PC_ID"), rs.getString("HOSTNAME"), rs.getString("IP_ADDRESS"),
                        rs.getString("ROOM_CD"), rs.getString("ROOM_NM"), rs.getString("DOCTOR_NM"),
                        rs.getString("SOUND_YN")),
                args);
        return list.isEmpty() ? null : list.get(0);
    }

    private static String safeSound(String v) { return "N".equalsIgnoreCase(v) ? "N" : "Y"; }

    private static OffsetDateTime toOffset(Timestamp t) {
        return t == null ? null : t.toInstant().atZone(ZoneId.systemDefault()).toOffsetDateTime();
    }
}
