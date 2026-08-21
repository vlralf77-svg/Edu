using System;
using System.Threading;
using System.Threading.Tasks;
using KioskNotifier.Models;

namespace KioskNotifier.Services;

public sealed class PollingTransport : INotifyTransport
{
    public string Name => "poll";
    public TransportState State { get; private set; } = TransportState.Idle;
    public event Action<Notice>? OnNotice;
    public event Action<TransportState, string?>? OnState;

    private readonly ApiClient _api;
    private readonly int _intervalSec;
    private readonly int _lookbackMinutes;
    private CancellationTokenSource? _cts;
    private Task? _loop;

    public PollingTransport(ApiClient api, int intervalSec, int lookbackMinutes)
    {
        _api = api;
        _intervalSec = Math.Max(1, intervalSec);
        _lookbackMinutes = lookbackMinutes;
    }

    public Task StartAsync(string roomCd, CancellationToken ct)
    {
        _cts = CancellationTokenSource.CreateLinkedTokenSource(ct);
        _loop = Task.Run(() => LoopAsync(roomCd, _cts.Token));
        return Task.CompletedTask;
    }

    public async Task StopAsync()
    {
        try { _cts?.Cancel(); } catch { }
        try { if (_loop is not null) await _loop; } catch { }
    }

    public async ValueTask DisposeAsync() => await StopAsync();

    private async Task LoopAsync(string roomCd, CancellationToken ct)
    {
        SetState(TransportState.Polling, $"{_intervalSec}s");
        while (!ct.IsCancellationRequested)
        {
            try
            {
                var pending = await _api.PendingAsync(roomCd, _lookbackMinutes, ct);
                foreach (var n in pending)
                    OnNotice?.Invoke(n);
                SetState(TransportState.Polling, $"{_intervalSec}s");
            }
            catch (Exception ex)
            {
                SetState(TransportState.Failed, ex.Message);
            }

            try { await Task.Delay(TimeSpan.FromSeconds(_intervalSec), ct); } catch { }
        }
    }

    private void SetState(TransportState s, string? info)
    {
        State = s;
        OnState?.Invoke(s, info);
    }
}
