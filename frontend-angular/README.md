# Frontend Angular — tempo real demo

`services/` — `PollingService`, `SseService`, `SocketService` são `@Injectable({ providedIn: "root" })`, retornam Observable. Não sabem de UI.
`components/*-panel` — "espertos": injetam o serviço, assinam no `ngOnInit`, cancelam no `ngOnDestroy`.
`components/status-card`, `components/update-log` — "burros": só `@Input()`, sem injeção de serviço nenhuma.

```
npm install
npm start          # http://localhost:4300 — precisa do backend rodando em :4000
```
