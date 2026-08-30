package http_test

import (
	"context"
	crand "crypto/rand"
	"crypto/rsa"
	"crypto/tls"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/pem"
	"fmt"
	"io"
	"log"
	"math/big"
	"math/rand/v2"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"testing"
	"time"

	. "github.com/onsi/gomega"

	wegohttp "github.com/weaveworks/weave-gitops/pkg/http"
)

// writeLocalhostCert generates a self-signed localhost cert/key into a per-test
// temp dir and returns their file paths.
func writeLocalhostCert(t *testing.T) (certFile, keyFile string) {
	t.Helper()

	key, err := rsa.GenerateKey(crand.Reader, 2048)
	if err != nil {
		t.Fatalf("generate key: %v", err)
	}

	tmpl := x509.Certificate{
		SerialNumber:          big.NewInt(1),
		Subject:               pkix.Name{CommonName: "localhost"},
		NotBefore:             time.Now().Add(-time.Hour),
		NotAfter:              time.Now().Add(24 * time.Hour),
		KeyUsage:              x509.KeyUsageDigitalSignature | x509.KeyUsageKeyEncipherment,
		ExtKeyUsage:           []x509.ExtKeyUsage{x509.ExtKeyUsageServerAuth},
		DNSNames:              []string{"localhost"},
		IPAddresses:           []net.IP{net.IPv4(127, 0, 0, 1), net.IPv6loopback},
		BasicConstraintsValid: true,
	}

	der, err := x509.CreateCertificate(crand.Reader, &tmpl, &tmpl, &key.PublicKey, key)
	if err != nil {
		t.Fatalf("create certificate: %v", err)
	}

	dir := t.TempDir()
	certFile = filepath.Join(dir, "localhost.crt")
	keyFile = filepath.Join(dir, "localhost.key")

	certPEM := pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: der})
	keyPEM := pem.EncodeToMemory(&pem.Block{Type: "RSA PRIVATE KEY", Bytes: x509.MarshalPKCS1PrivateKey(key)})

	if err := os.WriteFile(certFile, certPEM, 0o600); err != nil {
		t.Fatalf("write cert: %v", err)
	}
	if err := os.WriteFile(keyFile, keyPEM, 0o600); err != nil {
		t.Fatalf("write key: %v", err)
	}

	return certFile, keyFile
}

func portInUse(port int) bool {
	conn, err := net.Dial("tcp", fmt.Sprintf("localhost:%d", port))
	if err != nil {
		return false
	}
	conn.Close()
	return true
}

func TestMultiServerStartReturnsImmediatelyWithClosedContext(t *testing.T) {
	g := NewGomegaWithT(t)
	certFile, keyFile := writeLocalhostCert(t)
	srv := wegohttp.MultiServer{
		CertFile: certFile,
		KeyFile:  keyFile,
		Logger:   log.Default(),
	}
	ctx, cancel := context.WithCancel(t.Context())
	cancel()
	g.Expect(srv.Start(ctx, nil)).To(Succeed())
}

func TestMultiServerWithoutTLSConfigFailsToStart(t *testing.T) {
	g := NewGomegaWithT(t)
	srv := wegohttp.MultiServer{}

	err := srv.Start(t.Context(), nil)
	g.Expect(err).To(HaveOccurred())
	g.Expect(err.Error()).To(HavePrefix("failed to create TLS listener"))
}

func TestMultiServerServesOverBothProtocols(t *testing.T) {
	g := NewGomegaWithT(t)

	httpPort := rand.N(49151-1024) + 1024  // #nosec G404
	httpsPort := rand.N(49151-1024) + 1024 // #nosec G404

	for httpPort == httpsPort || portInUse(httpPort) || portInUse(httpsPort) {
		httpPort = rand.N(49151-1024) + 1024  // #nosec G404
		httpsPort = rand.N(49151-1024) + 1024 // #nosec G404
	}

	certFile, keyFile := writeLocalhostCert(t)
	srv := wegohttp.MultiServer{
		HTTPPort:  httpPort,
		HTTPSPort: httpsPort,
		CertFile:  certFile,
		KeyFile:   keyFile,
		Logger:    log.Default(),
	}
	ctx, cancel := context.WithCancel(t.Context())

	exitChan := make(chan struct{})
	go func(exitChan chan<- struct{}) {
		hndlr := http.HandlerFunc(func(rw http.ResponseWriter, r *http.Request) {
			fmt.Fprintf(rw, "success")
		})
		g.Expect(srv.Start(ctx, hndlr)).To(Succeed())
		close(exitChan)
	}(exitChan)

	// test HTTP

	var resp *http.Response

	g.Eventually(func() error {
		var err error
		resp, err = http.Get(fmt.Sprintf("http://localhost:%d/", httpPort))
		return err
	}).Should(Succeed())
	g.Expect(resp).NotTo(BeNil(), "response is nil even though no error has been returned")
	g.Expect(resp.StatusCode).To(Equal(http.StatusOK))
	body, err := io.ReadAll(resp.Body)
	g.Expect(err).NotTo(HaveOccurred())
	g.Expect(string(body)).To(Equal("success"))

	// test HTTPS

	certBytes, err := os.ReadFile(certFile)
	g.Expect(err).NotTo(HaveOccurred())

	rootCAs := x509.NewCertPool()
	rootCAs.AppendCertsFromPEM(certBytes)

	tr := &http.Transport{
		TLSClientConfig: &tls.Config{
			RootCAs:    rootCAs,
			MinVersion: tls.VersionTLS12,
		},
	}
	c := http.Client{
		Transport: tr,
	}
	resp, err = c.Get(fmt.Sprintf("https://localhost:%d/", httpsPort))
	g.Expect(err).NotTo(HaveOccurred())
	g.Expect(resp.StatusCode).To(Equal(http.StatusOK))
	body, err = io.ReadAll(resp.Body)
	g.Expect(err).NotTo(HaveOccurred())
	g.Expect(string(body)).To(Equal("success"))

	cancel()
	g.Eventually(exitChan, "3s").Should(BeClosed())

	// ensure both ports are freed up

	_, err = c.Get(fmt.Sprintf("https://localhost:%d/", httpsPort))
	g.Expect(err).To(HaveOccurred())
	g.Expect(err.Error()).To(ContainSubstring("connection refused"))

	_, err = http.Get(fmt.Sprintf("http://localhost:%d/", httpPort))
	g.Expect(err).To(HaveOccurred())
	g.Expect(err.Error()).To(ContainSubstring("connection refused"))
}
