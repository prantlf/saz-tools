package sazparser

import (
	"archive/zip"
	"bufio"
	"encoding/xml"
	"errors"
	"io"
	"io/ioutil"
	"net/http"
)

func ParseFile(fileName string) ([]Session, error) {
	archiveReader, err := zip.OpenReader(fileName)
	if err != nil {
		return nil, err
	}
	defer archiveReader.Close()
	return parseArchive(&archiveReader.Reader)
}

func ParseReader(reader io.ReaderAt, size int64) ([]Session, error) {
	archiveReader, err := zip.NewReader(reader, size)
	if err != nil {
		return nil, err
	}
	return parseArchive(archiveReader)
}

func parseArchive(archiveReader *zip.Reader) ([]Session, error) {
	var request *http.Request
	var response *http.Response
	var session Session
	var sessions []Session

	for _, archivedFile := range archiveReader.File {
		match, number, fileType, err := parseArchivedFileName(archivedFile.Name)
		if err != nil {
			return nil, err
		}
		if match == false {
			continue
		}

		switch fileType {
		case "c":
			fileReader, err := archivedFile.Open()
			if err != nil {
				return nil, err
			}
			defer fileReader.Close()

			requestReader := bufio.NewReader(fileReader)
			request, err = http.ReadRequest(requestReader)
			if err != nil {
				return nil, err
			}

		case "m":
			fileReader, err := archivedFile.Open()
			if err != nil {
				return nil, err
			}
			defer fileReader.Close()

			bytes, err := ioutil.ReadAll(fileReader)
			if err != nil {
				return nil, err
			}
			xml.Unmarshal(bytes, &session)

		case "s":
			fileReader, err := archivedFile.Open()
			if err != nil {
				return nil, err
			}
			defer fileReader.Close()

			responseReader := bufio.NewReader(fileReader)
			response, err = http.ReadResponse(responseReader, request)
			if err != nil {
				return nil, err
			}

			session.Number = number
			session.Request = request
			session.Response = response
			session.Flags = make(map[string]string)
			for _, flag := range session.RawFlags.Flags {
				session.Flags[flag.Name] = flag.Value
			}
			sessions = append(sessions, session)
		}
	}

	if len(sessions) == 0 {
		return nil, errors.New("No sessions were found.")
	}
	return sessions, nil
}