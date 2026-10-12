# Website Traffic Generator with GUI using Python

## Overview

This project provides a Graphical User Interface (GUI) built with Tkinter to generate traffic for a specific website. By leveraging this application, users can input the desired website URL and configure traffic generation settings directly from the desktop interface.

> **Desktop application** — this is *not* a web app. It runs as a native program on
> Windows / macOS / Linux (see *Browser or desktop?* at the bottom) and needs
> Python + a local Chrome browser to work.

## Prerequisites

- Python 3.8+ installed on your desktop.
- Internet connectivity to fetch dependencies.
- A Chrome browser (portable Chrome for Testing can be fetched with `setup_drivers.sh`).
- Ensure you are running the application on a desktop environment.

## Installation Steps

1. Clone the repository to your local machine:
    ```bash
    git clone <your-repo-url>.git
    ```

2. Navigate to the project directory:
    ```bash
    cd Website-Traffic-Generator-With-GUI
    ```

3. Install the necessary Python packages. It's recommended to set up a virtual environment first:
    ```bash
    python -m venv venv
    source venv/bin/activate  # On Windows, use: venv\Scripts\activate
    pip install -r requirements.txt
    ```

4. (Optional, recommended) Fetch a portable, always-matching Chrome + chromedriver pair:
    ```bash
    bash setup_drivers.sh     # downloads into ./drivers/ — no root required
    ```
    `main.py` locates drivers automatically. It checks, in order:
    - `CHROMEDRIVER_PATH` / `CHROME_BINARY` environment variables
    - `./drivers/` (created by `setup_drivers.sh`)
    - the `chromedriver` shipped with this repo, then the system `PATH`

## Running the Program

1. Ensure you are in the project directory containing the application files.

2. Execute the main Python script to launch the Tkinter GUI:
    ```bash
    python WebsiteTrafficGenerater.py
    ```

3. Once the GUI appears, you can input the URL `https://your-website-url.com` and configure other traffic generation settings as needed.

4. Follow the on-screen instructions to start the traffic generation process.

You can also drive it straight from the CLI, without the GUI:
```bash
python main.py -d example.com --threads 5 --max-clicks 4 --min-clicks 2 --timeout 30
```

## Browser or desktop?

This software **must be installed on a desktop** (Windows/macOS/Linux). It cannot
run inside a web browser because:

- the GUI is **Tkinter**, a native desktop toolkit (not HTML);
- **Selenium** drives a *locally installed* Chrome browser;
- the optional mouse-emulation feature (**PyAutoGUI**) controls the physical mouse.

On a headless Linux server it still runs — launch it under a virtual display:

```bash
xvfb-run -a python WebsiteTrafficGenerater.py   # or use the provided run_app.sh
```

## Troubleshooting

If you encounter any issues or have questions regarding the project, please feel free to contact me directly at:

📞 **Phone:** +254793609747

## Disclaimer

This tool is designed for educational and testing purposes. Ensure you have appropriate permissions and use responsibly.

---

For additional assistance or inquiries, do not hesitate to reach out. Happy traffic generating!
