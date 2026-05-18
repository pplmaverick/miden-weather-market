#![no_std]
#![feature(alloc_error_handler)]

extern crate alloc;

use miden::{Felt, StorageValue, component};

#[component]
struct CounterContract {
    #[storage()]
    count: StorageValue<Felt>,
}

#[component]
impl CounterContract {
    /// 讀取目前計數值
    pub fn get_count(&self) -> Felt {
        self.count.get()
    }

    /// 計數器加一，回傳新值
    pub fn increment(&mut self) -> Felt {
        let new_val = self.count.get() + Felt::new(1);
        self.count.set(new_val);
        new_val
    }

    /// 計數器減一，回傳新值
    pub fn decrement(&mut self) -> Felt {
        let new_val = self.count.get() - Felt::new(1);
        self.count.set(new_val);
        new_val
    }

    /// 重設計數器為 0
    pub fn reset(&mut self) {
        self.count.set(Felt::new(0));
    }
}
