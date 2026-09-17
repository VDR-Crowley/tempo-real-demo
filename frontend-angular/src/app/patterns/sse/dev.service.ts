import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Observable } from "rxjs";
import { environment } from "../../../environments/environment";

@Injectable({ providedIn: "root" })
export class DevService {
  constructor(private http: HttpClient) {}

  // POST /api/dev/drop-sse — botão "Simular queda": derruba toda conexão SSE aberta.
  dropSseConnections(): Observable<{ dropped: number }> {
    return this.http.post<{ dropped: number }>(`${environment.apiUrl}/api/dev/drop-sse`, {});
  }
}
