Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

' Get the directory of the currently running script
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)

' Run device_service.py silently
WshShell.Run "python """ & scriptDir & "\device_service.py""", 0, False
