#!/usr/bin/env python3
"""Local static preview with byte ranges for seeking in long audio files."""
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from functools import partial
from pathlib import Path
import argparse, re, os

class Handler(SimpleHTTPRequestHandler):
    def send_head(self):
        self.remaining=None
        path=self.translate_path(self.path)
        if not os.path.isfile(path) or 'Range' not in self.headers:
            return super().send_head()
        file=open(path,'rb');size=os.fstat(file.fileno()).st_size
        match=re.fullmatch(r'bytes=(\d*)-(\d*)',self.headers['Range'].strip())
        if not match or not any(match.groups()):
            file.close();self.send_error(416);return None
        a,b=match.groups()
        start=int(a) if a else max(0,size-int(b));end=min(int(b),size-1) if a and b else size-1
        if start>=size or end<start:
            file.close();self.send_response(416);self.send_header('Content-Range',f'bytes */{size}');self.end_headers();return None
        self.send_response(206);self.send_header('Content-type',self.guess_type(path));self.send_header('Content-Range',f'bytes {start}-{end}/{size}');self.send_header('Content-Length',str(end-start+1));self.send_header('Last-Modified',self.date_time_string(os.fstat(file.fileno()).st_mtime));self.end_headers()
        file.seek(start);self.remaining=end-start+1;return file
    def end_headers(self):
        self.send_header('Accept-Ranges','bytes');super().end_headers()
    def copyfile(self,source,output):
        if self.remaining is None:return super().copyfile(source,output)
        while self.remaining:
            data=source.read(min(65536,self.remaining))
            if not data:break
            output.write(data);self.remaining-=len(data)
    def log_message(self,fmt,*args):
        if args and str(args[1] if len(args)>1 else '') not in ('200','206','304'):
            super().log_message(fmt,*args)

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--port',type=int,default=4200);p.add_argument('--directory',default='outputs');args=p.parse_args()
    server=ThreadingHTTPServer(('127.0.0.1',args.port),partial(Handler,directory=str(Path(args.directory).resolve())))
    print(f'Serving {Path(args.directory).resolve()} at http://127.0.0.1:{args.port}',flush=True)
    server.serve_forever()
