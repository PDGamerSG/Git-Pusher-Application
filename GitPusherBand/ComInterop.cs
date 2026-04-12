using System;
using System.Runtime.InteropServices;

namespace GitPusherBand
{
    internal static class HResult
    {
        public const int S_OK = 0;
        public const int S_FALSE = 1;
        public const int E_FAIL = unchecked((int)0x80004005);
        public const int E_NOTIMPL = unchecked((int)0x80004001);
    }

    [Flags]
    internal enum DBIM : uint
    {
        MINSIZE = 0x0001,
        MAXSIZE = 0x0002,
        INTEGRAL = 0x0004,
        ACTUAL = 0x0008,
        TITLE = 0x0010,
        MODEFLAGS = 0x0020,
        BKGNDCOLOR = 0x0040
    }

    [Flags]
    internal enum DBIMF : uint
    {
        NORMAL = 0x0000,
        FIXED = 0x0001,
        FIXEDBMP = 0x0004,
        VARIABLEHEIGHT = 0x0008,
        UNDELETEABLE = 0x0010,
        DEBOSSED = 0x0020,
        BKCOLOR = 0x0040,
        USECHEVRON = 0x0080,
        BREAK = 0x0100,
        TOPALIGN = 0x0200,
        NOGRIPPER = 0x0400,
        ALWAYSGRIPPER = 0x0800,
        NOMARGINS = 0x1000
    }

    [StructLayout(LayoutKind.Sequential)]
    internal struct POINTL
    {
        public int x;
        public int y;
    }

    [StructLayout(LayoutKind.Sequential)]
    internal struct RECT
    {
        public int left;
        public int top;
        public int right;
        public int bottom;
    }

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    internal struct DESKBANDINFO
    {
        public uint dwMask;
        public POINTL ptMinSize;
        public POINTL ptMaxSize;
        public POINTL ptIntegral;
        public POINTL ptActual;

        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 255)]
        public string wszTitle;

        public DBIMF dwModeFlags;
        public int crBkgnd;
    }

    [ComImport]
    [Guid("00000114-0000-0000-C000-000000000046")]
    [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    internal interface IOleWindow
    {
        [PreserveSig]
        int GetWindow(out IntPtr phwnd);

        [PreserveSig]
        int ContextSensitiveHelp([MarshalAs(UnmanagedType.Bool)] bool fEnterMode);
    }

    [ComImport]
    [Guid("012DD920-7B26-11D0-8CA9-00A0C92DBFE8")]
    [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    internal interface IDockingWindow
    {
        [PreserveSig]
        int GetWindow(out IntPtr phwnd);

        [PreserveSig]
        int ContextSensitiveHelp([MarshalAs(UnmanagedType.Bool)] bool fEnterMode);

        [PreserveSig]
        int ShowDW([MarshalAs(UnmanagedType.Bool)] bool fShow);

        [PreserveSig]
        int CloseDW(uint dwReserved);

        [PreserveSig]
        int ResizeBorderDW(ref RECT prcBorder, IntPtr punkToolbarSite, [MarshalAs(UnmanagedType.Bool)] bool fReserved);
    }

    [ComImport]
    [Guid("EB0FE172-1A3A-11D0-89B3-00A0C90A90AC")]
    [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    internal interface IDeskBand
    {
        [PreserveSig]
        int GetWindow(out IntPtr phwnd);

        [PreserveSig]
        int ContextSensitiveHelp([MarshalAs(UnmanagedType.Bool)] bool fEnterMode);

        [PreserveSig]
        int ShowDW([MarshalAs(UnmanagedType.Bool)] bool fShow);

        [PreserveSig]
        int CloseDW(uint dwReserved);

        [PreserveSig]
        int ResizeBorderDW(ref RECT prcBorder, IntPtr punkToolbarSite, [MarshalAs(UnmanagedType.Bool)] bool fReserved);

        [PreserveSig]
        int GetBandInfo(uint dwBandID, uint dwViewMode, ref DESKBANDINFO pdbi);
    }

    [ComImport]
    [Guid("79D16DE4-ABEE-4021-8D9D-9169B261D657")]
    [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    internal interface IDeskBand2
    {
        [PreserveSig]
        int GetWindow(out IntPtr phwnd);

        [PreserveSig]
        int ContextSensitiveHelp([MarshalAs(UnmanagedType.Bool)] bool fEnterMode);

        [PreserveSig]
        int ShowDW([MarshalAs(UnmanagedType.Bool)] bool fShow);

        [PreserveSig]
        int CloseDW(uint dwReserved);

        [PreserveSig]
        int ResizeBorderDW(ref RECT prcBorder, IntPtr punkToolbarSite, [MarshalAs(UnmanagedType.Bool)] bool fReserved);

        [PreserveSig]
        int GetBandInfo(uint dwBandID, uint dwViewMode, ref DESKBANDINFO pdbi);

        [PreserveSig]
        int CanRenderComposited(out bool pfCanRenderComposited);

        [PreserveSig]
        int SetCompositionState([MarshalAs(UnmanagedType.Bool)] bool fCompositionEnabled);

        [PreserveSig]
        int GetCompositionState(out bool pfCompositionEnabled);
    }

    [ComImport]
    [Guid("FC4801A3-2BA9-11CF-A229-00AA003D7352")]
    [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    internal interface IObjectWithSite
    {
        [PreserveSig]
        int SetSite([MarshalAs(UnmanagedType.IUnknown)] object pUnkSite);

        [PreserveSig]
        int GetSite(ref Guid riid, out IntPtr ppvSite);
    }

    [ComImport]
    [Guid("0000010C-0000-0000-C000-000000000046")]
    [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    internal interface IPersist
    {
        [PreserveSig]
        int GetClassID(out Guid pClassID);
    }

    [ComImport]
    [Guid("00000109-0000-0000-C000-000000000046")]
    [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    internal interface IPersistStream
    {
        [PreserveSig]
        int GetClassID(out Guid pClassID);

        [PreserveSig]
        int IsDirty();

        [PreserveSig]
        int Load([MarshalAs(UnmanagedType.Interface)] System.Runtime.InteropServices.ComTypes.IStream pStm);

        [PreserveSig]
        int Save([MarshalAs(UnmanagedType.Interface)] System.Runtime.InteropServices.ComTypes.IStream pStm, [MarshalAs(UnmanagedType.Bool)] bool fClearDirty);

        [PreserveSig]
        int GetSizeMax(out long pcbSize);
    }

    internal static class NativeMethods
    {
        public const int SW_HIDE = 0;
        public const int SW_SHOW = 5;

        [DllImport("user32.dll", SetLastError = true)]
        public static extern IntPtr SetParent(IntPtr hWndChild, IntPtr hWndNewParent);

        [DllImport("user32.dll", SetLastError = true)]
        [return: MarshalAs(UnmanagedType.Bool)]
        public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
    }
}
