using System;
using System.Collections.Concurrent;
using System.Threading;
using System.Threading.Tasks;
using KioskNotifier.Models;

namespace KioskNotifier.Services;

public sealed class NotifyService : IAsyncDisposable
{
    private readonly AppSettings _settings;
    private readonly ApiClient _api;
    private readonly string _roomCd;

    private INotifyTransport? _transport;
    private CancellationTokenSource? _cts;
    private readonly ConcurrentDictionary<string, DateTimeOffset> _seen = new();

    public event Action<Notice>? OnNotice;
    public event Action<string>? OnStatus;

    public string CurrentTransportName => _transport?.Name ?? "-";
    public TransportState CurrentState => _transport?.State ?? TransportState.Idle;

    public NotifyService(AppSettings settings, ApiClient api, string roomCd)
    {
        _settings = settings;
        _api = api;
        _roomCd = roomCd;
    }

    public async Task StartAsync()
    {
        _cts = new CancellationTokenSource();
        var choice = (_settings.Transport ?? "auto").Trim().ToLowerInvariant();
        if (choice == "poll")
            await StartPollingAsync(_cts.Token);
        else
            await StartSocketAsync(autoFallback: choice == "auto", _cts.Token);
    }

    public async Task StopAsync()
    {
        try { _cts?.Cancel(); } catch { }
        if (_transport is not null)
        {
            await _transport.StopAsync();
            await _transport.DisposeAsync();
            _transport = null;
        }
    }

    public async ValueTask DisposeAsync() => await StopAsync();

    private async Task StartSocketAsync(bool autoFallback, CancellationToken ct)
    {
        var socket = new SocketTransport(_api.BaseUrl, _settings.ReconnectDelaySeconds);
        socket.OnNotice += HandleNotice;
        socket.OnState += (s, info) =>
        {
            var label = s switch
            {
                TransportState.Live       => "실시간",
                TransportState.Connecting => "연결중",
                TransportState.Failed     => $"소켓오류({info})",
                _ => s.ToString()
            };
            OnStatus?.Invoke(label);

            if (autoFallback && s == TransportState.Failed &&
                socket.ConsecutiveFails >= Math.Max(1, _settings.SocketFailLimit))
            {
                _ = Task.Run(async () =>
                {
                    LocalStore.Log($"WS {socket.ConsecutiveFails}회 실패, 폴링 전환");
                    await socket.StopAsync();
                    await socket.DisposeAsync();
                    if (_transport == socket) _transport = null;
                    await StartPollingAsync(ct);
                });
            }
        };

        _transport = socket;
        await socket.StartAsync(_roomCd, ct);
        _ = Task.Run(async () =>
        {
            try
            {
                var pending = await _api.PendingAsync(_roomCd, _settings.PendingLookbackMinutes, ct);
                foreach (var n in pending) HandleNotice(n);
            }
            catch { }
        });
    }

    private async Task StartPollingAsync(CancellationToken ct)
    {
        var poll = new PollingTransport(_api, _settings.PollIntervalSeconds, _settings.PendingLookbackMinutes);
        poll.OnNotice += HandleNotice;
        poll.OnState += (s, info) =>
        {
            var label = s switch
            {
                TransportState.Polling => $"주기 확인({info})",
                TransportState.Failed  => $"폴링오류({info})",
                _ => s.ToString()
            };
            OnStatus?.Invoke(label);
        };

        _transport = poll;
        await poll.StartAsync(_roomCd, ct);
    }

    private void HandleNotice(Notice n)
    {
        if (string.IsNullOrEmpty(n.EventId)) return;
        if (!_seen.TryAdd(n.EventId, DateTimeOffset.UtcNow)) return;

        PruneSeen();

        _ = _api.AckAsync(n.EventId, CancellationToken.None);
        OnNotice?.Invoke(n);
    }

    private void PruneSeen()
    {
        if (_seen.Count < 1024) return;
        var cutoff = DateTimeOffset.UtcNow.AddHours(-2);
        foreach (var kv in _seen)
            if (kv.Value < cutoff) _seen.TryRemove(kv.Key, out _);
    }
}
