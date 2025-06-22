## [Ticket Performance Improvements]

- **Performance test for creating tickets involving 15,000 users**
  - **Before:** 42 ms
  - **After:** 3 ms
  - ✅ ~14× speed improvement

---

## [Report Performance Improvements]

- **Improved performance by leveraging `worker_threads`**

  - **Before:**

    ```json
    {
      "accounts.csv": "finished in 2.25s",
      "yearly.csv": "finished in 1.61s",
      "fs.csv": "finished in 2.23s"
    }
    ```

  - **After:** (3 processes took 0.87s in TOTAL)
    ```json
    {
      "accounts.csv": "finished in 0.87s",
      "yearly.csv": "finished in 0.87s",
      "fs.csv": "finished in 0.87s"
    }
    ```
