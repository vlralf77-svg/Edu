using System;
using System.Media;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Interop;
using System.Windows.Media;
using System.Windows.Media.Animation;
using System.Windows.Threading;
using KioskNotifier.Models;

namespace KioskNotifier.Views;

public partial class ToastWindow : Window
{
    private const int WS_EX_NOACTIVATE = 0x08000000;
    private const int WS_EX_TOOLWINDOW = 0x00000080;
    private const int GWL_EXSTYLE      = -20;

    [System.Runtime.InteropServices.DllImport("user32.dll")]
    private static extern int GetWindowLong(IntPtr hWnd, int nIndex);
    [System.Runtime.InteropServices.DllImport("user32.dll")]
    private static extern int SetWindowLong(IntPtr hWnd, int nIndex, int dwNewLong);

    public string EventId { get; }
    public event Action<ToastWindow>? OnDismissed;
    public event Action<ToastWindow>? OnClicked;

    private readonly TimeSpan _duration;
    private readonly DispatcherTimer _timer;
    private DateTime _endsAt;
    private bool _paused;
    private bool _dismissed;
    private double _fullWidth;

    public ToastWindow(Notice notice, TimeSpan duration, bool sound)
    {
        InitializeComponent();
        EventId = notice.EventId;
        _duration = duration;
        _fullWidth = 360;

        ApplyContent(notice);

        if (sound)
        {
            try { SystemSounds.Asterisk.Play(); } catch { }
        }

        _timer = new DispatcherTimer(DispatcherPriority.Normal)
        {
            Interval = TimeSpan.FromMilliseconds(60)
        };
        _timer.Tick += Timer_Tick;

        Loaded += ToastWindow_Loaded;
    }

    private void ApplyContent(Notice n)
    {
        (string typeLabel, Color accent) = (n.MsgType ?? "ARRIVAL").ToUpperInvariant() switch
        {
            "CALL"   => ("호출 알림", Color.FromRgb(0x2B, 0x7C, 0xE9)),
            "CANCEL" => ("취소 알림", Color.FromRgb(0xE8, 0x8B, 0x2C)),
            _        => ("도착 알림", Color.FromRgb(0x3D, 0xB2, 0x5B)),
        };
        TypeText.Text = typeLabel;
        var brush = new SolidColorBrush(accent);
        TypeText.Foreground = brush;
        AccentBar.Background = brush;
        CountdownFill.Background = brush;

        var name = string.IsNullOrWhiteSpace(n.PatientNm) ? "환자" : n.PatientNm;
        var no   = string.IsNullOrWhiteSpace(n.PatientNo) ? "" : $" ({n.PatientNo})";
        TitleText.Text = name + no;

        var when = n.CreatedAt == default ? DateTimeOffset.Now : n.CreatedAt;
        var extra = string.IsNullOrWhiteSpace(n.Memo) ? "" : "  · " + n.Memo;
        SubText.Text = $"접수 {when.LocalDateTime:HH:mm:ss}{extra}";
    }

    protected override void OnSourceInitialized(EventArgs e)
    {
        base.OnSourceInitialized(e);
        var hwnd = new WindowInteropHelper(this).Handle;
        var ex = GetWindowLong(hwnd, GWL_EXSTYLE);
        SetWindowLong(hwnd, GWL_EXSTYLE, ex | WS_EX_NOACTIVATE | WS_EX_TOOLWINDOW);
    }

    private void ToastWindow_Loaded(object sender, RoutedEventArgs e)
    {
        _fullWidth = ActualWidth;
        CountdownFill.Width = _fullWidth;
        _endsAt = DateTime.UtcNow + _duration;
        _timer.Start();
        AnimateSlideIn();
    }

    private void AnimateSlideIn()
    {
        var anim = new DoubleAnimation
        {
            From = 0,
            To = 1,
            Duration = TimeSpan.FromMilliseconds(180),
            EasingFunction = new CubicEase { EasingMode = EasingMode.EaseOut }
        };
        BeginAnimation(OpacityProperty, anim);
    }

    private void Timer_Tick(object? sender, EventArgs e)
    {
        if (_paused) return;
        var remaining = _endsAt - DateTime.UtcNow;
        if (remaining <= TimeSpan.Zero)
        {
            Dismiss();
            return;
        }
        var ratio = Math.Max(0, Math.Min(1, remaining.TotalMilliseconds / _duration.TotalMilliseconds));
        CountdownFill.Width = _fullWidth * ratio;
    }

    private void Root_MouseEnter(object sender, MouseEventArgs e)
    {
        _paused = true;
    }

    private void Root_MouseLeave(object sender, MouseEventArgs e)
    {
        if (!_paused) return;
        _paused = false;
        var remaining = TimeSpan.FromMilliseconds(_duration.TotalMilliseconds *
                        (CountdownFill.Width / Math.Max(1, _fullWidth)));
        _endsAt = DateTime.UtcNow + remaining;
    }

    private void Root_MouseLeftButtonUp(object sender, MouseButtonEventArgs e)
    {
        if (e.OriginalSource is Button) return;
        OnClicked?.Invoke(this);
        Dismiss();
    }

    private void CloseBtn_Click(object sender, RoutedEventArgs e) => Dismiss();

    public void Dismiss()
    {
        if (_dismissed) return;
        _dismissed = true;
        _timer.Stop();

        var anim = new DoubleAnimation
        {
            From = Opacity, To = 0,
            Duration = TimeSpan.FromMilliseconds(160)
        };
        anim.Completed += (_, _) =>
        {
            OnDismissed?.Invoke(this);
            try { Close(); } catch { }
        };
        BeginAnimation(OpacityProperty, anim);
    }

    protected override void OnActivated(EventArgs e) { }
}
