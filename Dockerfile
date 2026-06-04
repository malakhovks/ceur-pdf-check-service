FROM debian:bookworm-slim

ENV DEBIAN_FRONTEND=noninteractive
ENV HOME=/opt/ceur
ENV PATH=/opt/ceur/bin:/usr/local/bin:/usr/local/sbin:/usr/sbin:/usr/bin:/sbin:/bin

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        bash \
        binutils \
        ca-certificates \
        coreutils \
        curl \
        findutils \
        gawk \
        grep \
        perl \
        poppler-utils \
        python3 \
        python3-pdfminer \
        qpdf \
        sed \
    && rm -rf /var/lib/apt/lists/*

RUN mkdir -p /opt/ceur/bin \
    && curl -fsSL https://ceur-ws.org/ceurtools/check-pdf-errors \
        -o /opt/ceur/bin/check-pdf-errors \
    && curl -fsSL https://ceur-ws.org/ceurtools/check-libbyhead.py \
        -o /opt/ceur/bin/check-libbyhead.py \
    && chmod +x /opt/ceur/bin/check-pdf-errors /opt/ceur/bin/check-libbyhead.py

COPY bin/ceur-pdf-check /usr/local/bin/ceur-pdf-check
RUN chmod +x /usr/local/bin/ceur-pdf-check

WORKDIR /work
ENTRYPOINT ["ceur-pdf-check"]
