# Document Reviewer

A Webapp that helps the user manually review any mistakes AIs could make during Document analysis.

## Build & Run

To build the repository from scratch (and run it), it's highly recommended you use [`uv`](https://docs.astral.sh/uv/getting-started/installation/) as it's a faster and more convenient alternative to standard `pip`. \
If you don't want to use `uv`, however, there are also steps below on how to build the project only using standard `pip`.

### With `uv`

In order to execute the following steps, `uv` must already be installed in your machine. Once you have it, then run:

```bash
# if you already cloned the project, skip these 2 steps
git clone https://github.com/KFN002/hci-group-project-1.git hci
cd hci

# after cloning the project and you're on the directory, run these:
uv sync
uv run dr
```

### Without `uv`

If you choose to use `pip` instead, then you have to create the venv manually and install the packages in requirements.txt (after cloning the project)

```bash
# if you already cloned the project, skip these 2 steps
git clone https://github.com/KFN002/hci-group-project-1.git hci
cd hci

# after cloning the project and you're on the directory, run these:
python3 -m venv .venv

# if using Linux/MacOS/... (UNIX-like), execute this command:
source .venv/bin/activate

# if using Windows, execute this command:
.venv\Scripts\activate

# after setting up venv, install the packages:
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
python -m pip install --editable .
```

Then, to start the development server:

```bash
dr
```

You can also run uvicorn directly, with:

```bash
python -m uvicorn document_reviewer.main:app --reload
```

## API

The API will be better documented on this repository's [wiki](https://github.com/KFN002/hci-project-group-1/wiki) page

## Dependencies

The direct runtime dependencies are listed in [`requirements.txt`](requirements.txt) for pip users and in [`pyproject.toml`](pyproject.toml) for both pip and uv.

## Academic Information

This project is a group project conducted by Kirill, Gonçalo, Smridh, Omar, Efe and Fatima for the module of Human-Computer Interactions (LZSCC.241). 
