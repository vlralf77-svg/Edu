using System;
using System.Collections.Generic;
using System.Drawing;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Threading;
using KioskNotifier.Models;
using KioskNotifier.Services;
using KioskNotifier.Views;
using WinForms = System.Windows.Forms;

namespace KioskNotifier;

public partial class App : Application
{
    private const string MutexName = "Global\\KioskNotifier.SingleInstance.Mutex";
    private Mutex? _singleInstance;
    private WinForms.NotifyIcon? _tray;
    private AppSettings _settings = new();
    private RoomConfig? _room;
    private ApiClient? _api;
    private NotifyService? _svc;

    private readonly List<ToastWindow> _toasts = new();

    protected override async void OnStartup(StartupEventArgs e)
    {
        base.OnStartup(e);

        bool created;
        _singleInstance = new Mutex(true, MutexName, out created);
        if (!created)
        {
            MessageBox.Show("KioskNotifier 가 이미 실행 중입니다.", "안내",
                MessageBoxButton.OK, MessageBoxImage.Information);
            Shutdown(0);
            return;
        }

        DispatcherUnhandledException += (_, args) =>
        {
            LocalStore.Log("UnhandledException: " + args.Exception);
            args.Handled = true;
        };
        AppDomain.CurrentDomain.UnhandledException += (_, args) =>
        {
            LocalStore.Log("DomainUnhandled: " + args.ExceptionObject);
        };
        TaskScheduler.UnobservedTaskException += (_, args) =>
        {
            LocalStore.Log("UnobservedTask: " + args.Exception);
            args.SetObserved();
        };

        _settings = LocalStore.LoadSettings();
        _api = new ApiClient(_settings.ServerBaseUrl);

        BuildTray();

        var pcId = LocalStore.GetOrCreatePcId();
        var host = LocalStore.Hostname;
        var ip   = LocalStore.PrimaryIpv4();

        _room = LocalStore.LoadRoom();
        if (_room is null)
        {
            try
            {
                using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(5));
                _room = await _api.ResolveRoomAsync(pcId, host, ip, cts.Token);
                if (_room is not null) LocalStore.SaveRoom(_room);
            }
            catch (Exception ex) { LocalStore.Log("ResolveRoom failed: " + ex.Message); }
        }

        if (_room is null || string.IsNullOrEmpty(_room.RoomCd))
        {
            if (!ShowSettings(mustSet: true))
            {
                Shutdown(0);
                return;
            }
        }

        if (_settings.AutoStart) LocalStore.SetAutoStart(true);

        await StartNotifyService();
    }

    protected override void OnExit(ExitEventArgs e)
    {
        try { _svc?.StopAsync().GetAwaiter().GetResult(); } catch { }
        try { _tray?.Dispose(); } catch { }
        try { _singleInstance?.ReleaseMutex(); } catch { }
        base.OnExit(e);
    }

    private void BuildTray()
    {
        _tray = new WinForms.NotifyIcon
        {
            Icon = SystemIcons.Information,
            Visible = true,
            Text = "KioskNotifier"
        };

        var menu = new WinForms.ContextMenuStrip();
        menu.Items.Add("설정...", null, (_, _) => ShowSettings(mustSet: false));
        menu.Items.Add("알림 미리보기", null, (_, _) => PreviewToast());
        menu.Items.Add("로그 폴더 열기", null, (_, _) =>
        {
            try
            {
                var path = System.IO.Path.Combine(
                    Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
                    "KioskNotifier", "logs");
                System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo("explorer.exe", path) { UseShellExecute = true });
            }
            catch { }
        });
        menu.Items.Add(new WinForms.ToolStripSeparator());
        menu.Items.Add("종료", null, (_, _) => Shutdown(0));
        _tray.ContextMenuStrip = menu;

        _tray.MouseClick += (_, args) =>
        {
            if (args.Button == WinForms.MouseButtons.Left)
                ShowSettings(mustSet: false);
        };
    }

    private bool ShowSettings(bool mustSet)
    {
        var pcId = LocalStore.GetOrCreatePcId();
        var host = LocalStore.Hostname;
        var ip   = LocalStore.PrimaryIpv4();

        var win = new SettingsWindow(_api!, pcId, host, ip, _room, _settings.AutoStart);
        var ok = win.ShowDialog() == true;
        if (!ok) return !mustSet && _room is not null;

        _room = win.Result;
        LocalStore.Log($"설정 저장: room={_room?.RoomCd} sound={_room?.SoundYn}");
        UpdateTrayTooltip("설정 저장됨");

        _ = Task.Run(async () =>
        {
            if (_svc is not null) await _svc.StopAsync();
            await StartNotifyService();
        });
        return true;
    }

    private async Task StartNotifyService()
    {
        if (_room is null || _api is null) return;

        _svc = new NotifyService(_settings, _api, _room.RoomCd);
        _svc.OnNotice += n => Dispatcher.BeginInvoke(new Action(() => ShowToast(n)));
        _svc.OnStatus += s => Dispatcher.BeginInvoke(new Action(() => UpdateTrayTooltip(s)));
        await _svc.StartAsync();
        UpdateTrayTooltip(_svc.CurrentState.ToString());
    }

    private void UpdateTrayTooltip(string status)
    {
        if (_tray is null) return;
        var room = _room?.RoomNm is { Length: > 0 } ? _room.RoomNm : _room?.RoomCd ?? "미지정";
        var tr = _svc?.CurrentTransportName ?? "-";
        var text = $"[{room}] {tr} · {status}";
        if (text.Length > 63) text = text.Substring(0, 63);
        _tray.Text = text;
    }

    private void PreviewToast()
    {
        ShowToast(new Notice
        {
            EventId = "preview-" + Guid.NewGuid().ToString("N"),
            RoomCd = _room?.RoomCd ?? "TEST",
            MsgType = "ARRIVAL",
            PatientNo = "12345678",
            PatientNm = "홍길동",
            CreatedAt = DateTimeOffset.Now
        });
    }

    private void ShowToast(Notice n)
    {
        var soundOn = !string.Equals(_room?.SoundYn, "N", StringComparison.OrdinalIgnoreCase)
                      && !string.Equals(n.SoundYn, "N", StringComparison.OrdinalIgnoreCase);

        while (_toasts.Count >= Math.Max(1, _settings.MaxVisibleToasts))
        {
            var oldest = _toasts[0];
            _toasts.RemoveAt(0);
            try { oldest.Dismiss(); } catch { }
        }

        var toast = new ToastWindow(n, TimeSpan.FromSeconds(_settings.ToastDurationSeconds), soundOn);
        toast.OnDismissed += RemoveAndRestack;
        toast.OnClicked += t =>
        {
            _ = _api?.ReadAsync(t.EventId, CancellationToken.None);
        };

        PositionToast(toast, _toasts.Count);
        _toasts.Add(toast);
        toast.Show();
    }

    private void RemoveAndRestack(ToastWindow t)
    {
        var idx = _toasts.IndexOf(t);
        if (idx < 0) return;
        _toasts.RemoveAt(idx);
        for (int i = 0; i < _toasts.Count; i++) PositionToast(_toasts[i], i);
    }

    private static void PositionToast(ToastWindow toast, int index)
    {
        var wa = SystemParameters.WorkArea;
        const double margin = 12;
        const double gap = 8;
        double width = toast.Width;
        double height = toast.Height;

        toast.Left = wa.Right - width - margin;
        toast.Top  = wa.Bottom - (height + gap) * (index + 1) - margin + gap;
    }
}
