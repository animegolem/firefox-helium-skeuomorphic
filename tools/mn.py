import socket, json, sys, base64
class M:
    def __init__(s, port=2931):
        s.s = socket.create_connection(("127.0.0.1", port)); s.i = 0; s.read()
    def read(s):
        buf = b""
        while b":" not in buf: buf += s.s.recv(1)
        n, rest = buf.split(b":", 1); n = int(n)
        while len(rest) < n: rest += s.s.recv(n - len(rest))
        return json.loads(rest)
    def cmd(s, name, params=None):
        s.i += 1
        d = json.dumps([0, s.i, name, params or {}]).encode()
        s.s.sendall(str(len(d)).encode() + b":" + d)
        r = s.read()
        if r[2]: raise RuntimeError(r[2])
        return r[3]
    def js(s, code, args=None):
        return s.cmd("WebDriver:ExecuteScript", {"script": code, "args": args or []}).get("value")
def connect():
    m = M(); m.cmd("WebDriver:NewSession", {"capabilities": {}}); m.cmd("Marionette:SetContext", {"value": "chrome"}); return m
