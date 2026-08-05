from athena.worker.scheduler import JobRegistry, build_scheduler


def test_jobs_register_and_run():
    reg = JobRegistry()
    calls = []

    @reg.job("noop", cron="0 3 * * *")
    def noop():
        calls.append(1)

    assert "noop" in reg.names()
    reg.run_now("noop")
    assert calls == [1]


def test_build_scheduler_adds_registered_jobs():
    reg = JobRegistry()

    @reg.job("daily", cron="0 3 * * *")
    def daily():
        pass

    sched = build_scheduler(reg, start=False)
    assert sched.get_job("daily") is not None
