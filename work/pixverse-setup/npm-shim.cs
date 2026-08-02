using System;
using System.Diagnostics;
using System.Linq;

internal static class Program
{
    private static string Quote(string value)
    {
        return "\"" + value.Replace("\"", "\\\"") + "\"";
    }

    public static int Main(string[] args)
    {
        var forwarded = string.Join(" ", args.Select(Quote));
        var command = "\"\"D:\\nodejs\\npm.cmd\"" +
            (forwarded.Length == 0 ? "" : " " + forwarded) + "\"";

        using (var process = Process.Start(new ProcessStartInfo
        {
            FileName = "cmd.exe",
            Arguments = "/d /s /c " + command,
            UseShellExecute = false
        }))
        {
            process.WaitForExit();
            return process.ExitCode;
        }
    }
}
