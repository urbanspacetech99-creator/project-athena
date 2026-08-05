from collections.abc import Callable

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger

from athena.logging_setup import get_logger

log = get_logger("athena.worker")


class JobRegistry:
    def __init__(self) -> None:
        self._jobs: dict[str, tuple[Callable, str]] = {}

    def job(self, name: str, cron: str):
        def decorator(fn: Callable) -> Callable:
            self._jobs[name] = (fn, cron)
            return fn
        return decorator

    def names(self) -> list[str]:
        return list(self._jobs)

    def run_now(self, name: str) -> None:
        fn, _ = self._jobs[name]
        log.info("job start", extra={"job": name, "trigger": "manual"})
        fn()
        log.info("job finish", extra={"job": name, "trigger": "manual"})

    def items(self):
        return self._jobs.items()


def build_scheduler(registry: JobRegistry, start: bool = True) -> BackgroundScheduler:
    sched = BackgroundScheduler()
    for name, (fn, cron) in registry.items():
        sched.add_job(fn, CronTrigger.from_crontab(cron), id=name, name=name)
    if start:
        sched.start()
    return sched
