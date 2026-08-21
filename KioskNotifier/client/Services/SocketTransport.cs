using System;
using System.Net.WebSockets;
using System.Text;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using KioskNotifier.Models;

namespace KioskNotifier.Services;

public sealed class SocketTransport : INotifyTransport
{
    public string Name => "socket";
    public TransportState State { get; private set; } = TransportState.Idle;
    public event Action<Notice>? OnNotice;
    public event Action<TransportState, string?>? OnState;

    private readonly string _serverBase;
    private readonly int _reconnectDelaySec;
    private CancellationTokenSource? _cts;
    private ClientWebSocket? _ws;
    private Task? _loop;
    private int _consecutiveFails;

    public int ConsecutiveFails => _consecutiveFails;

    public SocketTransport(string serverBaseUrl, int reconnectDelaySec)
    {
        _serverBase = serverBaseUrl.TrimEnd('/');
        _reconnectDelaySec = reconnectDelaySec;
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
        try { if (_ws is { State: WebSocketState.Open }) await _ws.CloseAsync(WebSocketCloseStatus.NormalClosure, "bye", CancellationToken.None); } catch { }
        try { if (_loop is not null) await _loop; } catch { }
    }

    public async ValueTask DisposeAsync()
    {
        await StopAsync();
        _ws?.Dispose();
    }

    private async Task LoopAsync(string roomCd, CancellationToken ct)
    {
        var wsUri = new Uri(_serverBase.Replace("http://", "ws://").Replace("https://", "wss://")
                            + "/ws/notify?room=" + Uri.EscapeDataString(roomCd));

        while (!ct.IsCancellationRequested)
        {
            _ws?.Dispose();
            _ws = new ClientWebSocket();
            _ws.Options.KeepAliveInterval = TimeSpan.FromSeconds(20);
            SetState(TransportState.Connecting, wsUri.ToString());

            try
            {
                using var connectCts = CancellationTokenSource.CreateLinkedTokenSource(ct);
                connectCts.CancelAfter(TimeSpan.FromSeconds(5));
                await _ws.ConnectAsync(wsUri, connectCts.Token);
                _consecutiveFails = 0;
                SetState(TransportState.Live, null);
                await ReceiveLoopAsync(ct);
            }
            catch (OperationCanceledException) when (ct.IsCancellationRequested) { break; }
            catch (Exception ex)
            {
                _consecutiveFails++;
                SetState(TransportState.Failed, ex.Message);
            }

            try { await Task.Delay(TimeSpan.FromSeconds(_reconnectDelaySec), ct); } catch { }
        }
    }

    private async Task ReceiveLoopAsync(CancellationToken ct)
    {
        var buf = new byte[8192];
        var mem = new System.IO.MemoryStream();

        while (!ct.IsCancellationRequested && _ws is { State: WebSocketState.Open })
        {
            mem.SetLength(0);
            WebSocketReceiveResult res;
            do
            {
                res = await _ws!.ReceiveAsync(new ArraySegment<byte>(buf), ct);
                if (res.MessageType == WebSocketMessageType.Close)
                {
                    await _ws.CloseAsync(WebSocketCloseStatus.NormalClosure, "close", ct);
                    return;
                }
                mem.Write(buf, 0, res.Count);
            } while (!res.EndOfMessage);

            var text = Encoding.UTF8.GetString(mem.ToArray());
            if (string.IsNullOrWhiteSpace(text)) continue;

            try
            {
                var opts = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };
                var notice = JsonSerializer.Deserialize<Notice>(text, opts);
                if (notice is { EventId.Length: > 0 })
                    OnNotice?.Invoke(notice);
            }
            catch { }
        }
    }

    private void SetState(TransportState s, string? info)
    {
        State = s;
        OnState?.Invoke(s, info);
    }
}
