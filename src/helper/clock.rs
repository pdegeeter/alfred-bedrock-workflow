use std::time::{SystemTime, UNIX_EPOCH};

pub struct Clock;

impl Clock {
    /// Current time in epoch milliseconds, the unit of every persisted expiry.
    pub fn now_ms() -> i64 {
        let elapsed = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system clock is after 1970");

        i64::try_from(elapsed.as_millis()).expect("epoch milliseconds fit in i64")
    }
}
