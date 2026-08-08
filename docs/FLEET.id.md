# Agent Fleet (Armada Agen)

Agent Fleet adalah control plane yang mengutamakan lokal (*local-first*) untuk eksekusi banyak pekerja (*multi-worker*) yang tahan lama. Fleet **bukanlah** mesin eksekusi terpisah: seorang pekerja fleet (*fleet worker*) adalah eksekusi `nestlone exec` tanpa antarmuka yang diluncurkan dan dilacak oleh fleet secara permanen.

Gunakan Fleet daripada pembagian tugas agen yang berumur pendek ketika pekerjaan membutuhkan percobaan ulang (*retry*), ketahanan terhadap mode tidur/restart komputer, eksekusi jarak jauh, bukti tanda terima (*receipts*), atau jejak audit ber-ledger.

---

## Perintah Dasar CLI Fleet

```sh
nestlone fleet init
nestlone fleet run tasks.json --max-workers 4
nestlone fleet status
nestlone fleet inspect <worker-id>
nestlone fleet logs <worker-id>
nestlone fleet artifacts <worker-id>
nestlone fleet interrupt <worker-id>
nestlone fleet restart <worker-id>
nestlone fleet resume <run-id>
nestlone fleet stop --all
```

`nestlone fleet resume <run-id>` adalah perintah pemulihan setelah sistem terhenti: perintah ini memutar ulang ledger, merekonsiliasi tugas yang terhenti (Mencoba lagi sesuai anggaran tugas, atau melaporkannya jika gagal), lalu menampilkan status setelah pemulihan. Perintah ini aman dijalankan setelah laptop terbangun dari mode tidur atau setelah restart runtime.

---

## Lokasi Penyimpanan Status

Status Fleet disimpan di dalam ruang kerja di bawah `.nestlone/fleet.jsonl`. Log pekerja dan log adapter disimpan di bawah `.nestlone/fleet/` dan `.nestlone/fleet-host/`.

### Perbedaan Status Interaktif dan Persisten

- Di dalam TUI: Perintah `/fleet status` (atau `/subagents`) menampilkan sub-agen yang terhubung ke sesi interaktif saat ini.
- Di dalam Shell: Perintah `nestlone fleet status` membaca riwayat eksekusi Fleet yang tersimpan di ledger `.nestlone/fleet.jsonl`.
