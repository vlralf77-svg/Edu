package hospital.notify;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.net.URI;
import java.util.Map;
import java.util.stream.Collectors;

@Configuration
@EnableWebSocket
public class NotifySocketConfig implements WebSocketConfigurer {

    private final NotifyRegistry registry;

    @Autowired
    public NotifySocketConfig(NotifyRegistry registry) {
        this.registry = registry;
    }

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry r) {
        r.addHandler(handler(), "/ws/notify").setAllowedOriginPatterns("*");
    }

    private WebSocketHandler handler() {
        return new TextWebSocketHandler() {

            @Override
            public void afterConnectionEstablished(WebSocketSession session) {
                String room = extractRoom(session);
                if (room == null) {
                    try { session.close(CloseStatus.BAD_DATA); } catch (Exception ignored) {}
                    return;
                }
                session.getAttributes().put("roomCd", room);
                registry.register(room, session);
            }

            @Override
            public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
                Object room = session.getAttributes().get("roomCd");
                if (room instanceof String s) registry.unregister(s, session);
            }
        };
    }

    private String extractRoom(WebSocketSession session) {
        URI uri = session.getUri();
        if (uri == null || uri.getQuery() == null) return null;
        Map<String, String> q = java.util.Arrays.stream(uri.getQuery().split("&"))
                .map(kv -> kv.split("=", 2))
                .filter(a -> a.length == 2)
                .collect(Collectors.toMap(a -> a[0], a -> java.net.URLDecoder.decode(a[1], java.nio.charset.StandardCharsets.UTF_8), (a, b) -> a));
        return q.get("room");
    }
}
